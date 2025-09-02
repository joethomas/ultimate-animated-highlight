(() => {
	"use strict";

	const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
	const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
	const debounce = (fn,t=150) => { let id; return (...args)=>{ clearTimeout(id); id=setTimeout(()=>fn(...args),t); }; };

	// Asset base from localized data or current script path
	const SCRIPT = document.currentScript || [...document.getElementsByTagName('script')].pop();
	const SCRIPT_DIR = SCRIPT ? (SCRIPT.src.replace(/\/[^\/]+$/, '/')) : '';
	const ASSETS_BASE = (typeof window.UAH_ASSETS === 'object' && window.UAH_ASSETS.base) ? window.UAH_ASSETS.base : SCRIPT_DIR;

	const SVG_MAP = (window.UAH_ASSETS && window.UAH_ASSETS.svgs) ? window.UAH_ASSETS.svgs : {
		marker:'highlight-marker.svg',
		line:'highlight-line.svg',
		swoosh:'highlight-swoosh.svg'
	};
	const ANCHORS = (window.UAH_ASSETS && window.UAH_ASSETS.anchors) ? window.UAH_ASSETS.anchors : {
		marker:3, line:0, swoosh:4
	};

	// Cache loaded svg defs
	const SHAPES = {}; // { style: {vw, vh, nodeName:'path'|'rect', d|rect params } }
	let maskIdSeq = 0;

	async function loadShape(style){
		if (SHAPES[style]) return SHAPES[style];
		const url = ASSETS_BASE + (SVG_MAP[style] || '');
		const res = await fetch(url, { credentials:'same-origin' });
		const txt = await res.text();
		const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
		const svg = doc.querySelector('svg');
		if (!svg) throw new Error(`UAH: No <svg> in ${style}`);
		const vb = (svg.getAttribute('viewBox')||'0 0 100 10').trim().split(/\s+/).map(parseFloat);
		const [ , , vw, vh ] = vb.length===4 ? vb : [0,0,100,10];
		const node = svg.querySelector('path, rect');
		if (!node) throw new Error(`UAH: No <path> or <rect> in ${style} svg`);
		const def = { vw, vh, nodeName: node.nodeName.toLowerCase() };
		if (def.nodeName === 'path'){
			def.d = node.getAttribute('d') || '';
		} else {
			def.x = parseFloat(node.getAttribute('x')||'0');
			def.y = parseFloat(node.getAttribute('y')||'0');
			def.width  = parseFloat(node.getAttribute('width')||vw);
			def.height = parseFloat(node.getAttribute('height')||Math.max(1, vh*0.2));
			def.rx = node.hasAttribute('rx') ? parseFloat(node.getAttribute('rx')) : 0;
			def.ry = node.hasAttribute('ry') ? parseFloat(node.getAttribute('ry')) : def.rx;
		}
		SHAPES[style] = def;
		return def;
	}

	// Length to px relative to host font
	function lenToPx(el, val){
		if (!val) return 0;
		const test = document.createElement('span');
		test.style.position = 'absolute';
		test.style.visibility = 'hidden';
		test.style.width = val;
		el.appendChild(test);
		const px = test.getBoundingClientRect().width;
		test.remove();
		return px || 0;
	}

	// Merge DOMRects into one rect per visual line
	function clusterRects(rects){
		const eps = 4;
		const lines = [];
		const sorted = rects.slice().sort((a,b)=>a.top-b.top);
		for (const r of sorted){
			let L = lines.find(v => Math.abs(v.top - r.top) < eps);
			if (!L){
				L = { top:r.top, bottom:r.bottom, left:r.left, right:r.right };
				lines.push(L);
			} else {
				L.top = Math.min(L.top, r.top);
				L.bottom = Math.max(L.bottom, r.bottom);
				L.left = Math.min(L.left, r.left);
				L.right = Math.max(L.right, r.right);
			}
		}
		return lines.map(L => ({
			top:L.top, left:L.left,
			width:Math.max(0, L.right - L.left),
			height:Math.max(0, L.bottom - L.top)
		}));
	}

	// Build geometry for requested style, scaled to (w,h) and aligned to baseline yBase.
	function buildShapeGroup(def, style, w, h, yBase, heightPx, dir, ky){
		const NS='http://www.w3.org/2000/svg';
		const g = document.createElementNS(NS,'g');

		if (style === 'marker' || style === 'swoosh'){
			const p = document.createElementNS(NS,'path');
			p.setAttribute('class','uah-path');
			p.setAttribute('d', def.d);
			p.setAttribute('stroke-width', Math.max(1, heightPx));
			p.setAttribute('vector-effect', 'non-scaling-stroke');
			p.setAttribute('stroke-linecap', style === 'marker' ? 'square' : 'round');
			p.setAttribute('stroke-linejoin','round');

			// scale to fit, then compress vertically by ky
			const sx = w / def.vw;
			const sy = (h / def.vh) * (ky || 1);
			const anchorY = ANCHORS[style] || 0;
			const ty = yBase - (anchorY * sy);

			let pre = '';
			if (dir === 'rtl') pre = ` translate(${def.vw} 0) scale(-1 1)`;

			g.setAttribute('transform', `translate(0 ${ty})${pre} scale(${sx} ${sy})`);
			g.appendChild(p);
		} else {
			const r = document.createElementNS(NS,'rect');
			const height = Math.max(1, heightPx);
			const y = clamp(yBase - height/2, 0, h - height);
			r.setAttribute('x', 0);
			r.setAttribute('y', y);
			r.setAttribute('width', w);
			r.setAttribute('height', height);
			r.setAttribute('rx', Math.min(12, height/3));
			r.setAttribute('class', 'uah-fill');
			g.appendChild(r);
		}
		return g;
	}

	function robustBoolAttr(val, fallback=true){
		const s = (val ?? '').toString().toLowerCase().trim();
		if (['0','false','off','no'].includes(s)) return false;
		if (['1','true','on','yes'].includes(s)) return true;
		return fallback;
	}

	async function initHighlight(host){
		const layer = host.querySelector('.uah-layer');
		layer.innerHTML = '';

		const textEl = host.querySelector('.uah-text');
		if (!textEl) return;

		const cs = getComputedStyle(host);
		const dir = cs.direction || document.dir || 'ltr';
		const curveMarker = parseFloat(cs.getPropertyValue('--uah-curve-marker')) || 0.20;
		const curveSwoosh = parseFloat(cs.getPropertyValue('--uah-curve-swoosh')) || 0.65;

		// Required: data-style (no legacy)
		const styleName = ((host.dataset && host.dataset.style) || 'marker').toLowerCase();

		const animated = robustBoolAttr(host.dataset.animated, true);

		// duration: prefer data-duration, else CSS var --uah-duration, else 1500
		let duration = parseInt(host.dataset.duration || '', 10);
		if (!Number.isFinite(duration)) {
			const varDur = (cs.getPropertyValue('--uah-duration') || '').trim(); // "1000ms" | "1s"
			if (varDur.endsWith('ms')) duration = parseFloat(varDur);
			else if (varDur.endsWith('s')) duration = Math.round(parseFloat(varDur) * 1000);
			else duration = 1500;
		}

		const colorClass = host.dataset.svgcolor || '';
		const angleDeg = clamp(parseFloat(host.dataset.angle || '0') || 0, -5, 5);

		// Measure visual lines
		const range = document.createRange();
		range.selectNodeContents(textEl);
		const rects = clusterRects(Array.from(range.getClientRects()));
		const base = host.getBoundingClientRect();

		const heightPx = (()=>{
			const val = cs.getPropertyValue('--uah-height').trim();
			return lenToPx(host, val) || Math.round((rects[0]?.height || 16) * 0.28);
		})();
		const offsetPx = lenToPx(host, cs.getPropertyValue('--uah-offset').trim());

		const defaultY = rH => rH * 0.82; // underline baseline
		const gap = 150; // ms stagger

		// Load the SVG def for this style once
		const def = await loadShape(styleName);

		rects.forEach((r, i) => {
			const NS='http://www.w3.org/2000/svg';
			const svg = document.createElementNS(NS, 'svg');
			svg.setAttribute('class', `uah-seg${colorClass ? ' '+colorClass : ''}`);
			svg.setAttribute('width', r.width);
			svg.setAttribute('height', r.height);
			svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
			svg.setAttribute('overflow', 'visible');
			svg.style.overflow = 'visible';
			svg.style.left = (r.left - base.left) + 'px';
			svg.style.top  = (r.top  - base.top)  + 'px';
			if (angleDeg !== 0) svg.style.transform = `rotate(${angleDeg}deg)`;

			// defs + mask
			const defs = document.createElementNS(NS, 'defs');
			const maskId = 'uahm-' + (++maskIdSeq);
			const mask = document.createElementNS(NS, 'mask');
			mask.setAttribute('id', maskId);
			mask.setAttribute('maskUnits', 'userSpaceOnUse');

			// reveal group scales from 0 -> 1 (LTR) or 1 -> 0 (RTL via origin)
			const reveal = document.createElementNS(NS, 'g');
			reveal.setAttribute('class','uah-reveal');
			reveal.style.transformOrigin = (dir === 'rtl') ? '100% 50%' : '0% 50%';

			const white = document.createElementNS(NS, 'rect');
			// generous padding so strokes aren’t clipped at the bottom (or ends)
			const pad = Math.ceil(Math.max(2, heightPx));
			white.setAttribute('x', -pad);
			white.setAttribute('y', -pad);
			white.setAttribute('width', r.width + pad*2);
			white.setAttribute('height', r.height + pad*2);
			white.setAttribute('fill', '#fff');
			reveal.appendChild(white);

			mask.appendChild(reveal);
			defs.appendChild(mask);
			svg.appendChild(defs);

			// masked content
			const content = document.createElementNS(NS, 'g');
			content.setAttribute('mask', `url(#${maskId})`);

			const yBase = defaultY(r.height) + offsetPx;

			// choose vertical compression (ky) by style
			const ky = (styleName === 'marker') ? curveMarker : (styleName === 'swoosh' ? curveSwoosh : 1);

			// geometry group
			const geo = buildShapeGroup(def, styleName, r.width, r.height, yBase, heightPx, dir, ky);
			content.appendChild(geo);
			svg.appendChild(content);

			// Apply Uncode SVG color class if present (e.g., "text-color-199166-color")
			// Note: wrapper kept --uah-color for hex; the class overrides via theme
			if (colorClass) svg.setAttribute('class', svg.getAttribute('class') + ' ' + colorClass);

			// Animate reveal
			const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (animated && !prefersReduce){
				const delay = i * (duration + gap);
				const kick = () => {
					reveal.style.transform = 'scaleX(0)';
					if (typeof reveal.animate === 'function') {
						reveal.animate(
							[{ transform:'scaleX(0)' }, { transform:'scaleX(1)' }],
							{ duration, delay, easing:'ease-in-out', fill:'forwards' }
						);
					} else {
						reveal.style.transitionProperty = 'transform';
						reveal.style.transitionTimingFunction = 'ease-in-out';
						reveal.style.transitionDuration = `${duration}ms`;
						reveal.style.transitionDelay = `${delay}ms`;
						requestAnimationFrame(() => { reveal.style.transform = 'scaleX(1)'; });
					}
				};
				requestAnimationFrame(kick);
			} else {
				reveal.style.transform = 'scaleX(1)';
			}

			// Append segment
			const layer = host.querySelector('.uah-layer');
			layer.appendChild(svg);
		});

		// Observe for resize/reflow
		if (!host._uahObserved){
			host._uahObserved = true;
			const ro = new ResizeObserver(debounce(() => initHighlight(host), 60));
			ro.observe(host);
		}
	}

	function processAll(){ $$('.uah').forEach(node => initHighlight(node)); }

	if (document.readyState === 'loading'){
		document.addEventListener('DOMContentLoaded', processAll);
	} else { processAll(); }
	window.addEventListener('resize', debounce(processAll, 150));
})();
