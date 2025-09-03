(() => {
	"use strict";

	const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
	const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
	const debounce = (fn,t=150) => { let id; return (...args)=>{ clearTimeout(id); id=setTimeout(()=>fn(...args),t); }; };

	// Asset base from localized data or current script path
	const SCRIPT = document.currentScript || [...document.getElementsByTagName('script')].pop();
	const SCRIPT_DIR = SCRIPT ? (SCRIPT.src.replace(/\/[^\/]+$/, '/')) : '';
	const CFG = (typeof window.UAH_ASSETS === 'object' && window.UAH_ASSETS) ? window.UAH_ASSETS : {};
	const ASSETS_BASE = CFG.base ? (CFG.base.endsWith('/') ? CFG.base : CFG.base + '/') : SCRIPT_DIR;
	const DEFAULT_SVGS = { marker:'highlight-marker.svg', line:'highlight-line.svg', swoosh:'highlight-swoosh.svg' };
	const DEFAULT_ANCHORS = { marker:3, line:0, swoosh:4 };
	const fileFor = (style) => (CFG.svgs && CFG.svgs[style]) ? CFG.svgs[style] : (DEFAULT_SVGS[style] || `highlight-${style}.svg`);
	const anchorFor = (style) => {
		const v = CFG.anchors ? Number(CFG.anchors[style]) : NaN;
		return Number.isFinite(v) ? v : (DEFAULT_ANCHORS[style] ?? 0);
	};

	// Cache loaded svg defs
	const SHAPES = {}; // { style: {vw, vh, nodeName:'path'|'rect', d|rect params } }
	let maskIdSeq = 0;

	async function loadShape(style){
		if (SHAPES[style]) return SHAPES[style];
		const url = ASSETS_BASE + fileFor(style);
		const res = await fetch(url, { credentials:'same-origin' });
		if (!res.ok){
			console.warn('[UAH] Failed to load', url, 'for style', style);
			// safe fallback: thin bar
			const def = { vw:100, vh:10, nodeName:'rect', x:0, y:4, width:100, height:2, rx:0, ry:0 };
			SHAPES[style] = def;
			return def;
		}
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
    	const s = String(val).trim();
    	const sign = s.startsWith('-') ? -1 : 1;
    	const abs = s.replace(/^[-+]/, ''); // measure the absolute value
    
    	const test = document.createElement('span');
    	test.style.position = 'absolute';
    	test.style.visibility = 'hidden';
    	test.style.width = abs; // width can't be negative, so we use |value|
    	el.appendChild(test);
    	const px = test.getBoundingClientRect().width;
    	test.remove();
    	return (px || 0) * sign; // reapply the sign
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
    // - ky: vertical curvature scale (0 = flattest; epsilon applied elsewhere)
    // - capPadFactor: ~0.5 means each end's cap extends ≈ strokeWidth/2
    // - widthFactor: 0.8..1.2 — 1 = match text width; <1 inset; >1 extend beyond
    function buildShapeGroup(def, style, w, h, yBase, heightPx, dir, ky, capPadFactor, widthFactor, anchorY){
    	const NS='http://www.w3.org/2000/svg';
    	const g = document.createElementNS(NS,'g');
    
    	// effective cap padding in px (for stroked ends)
    	const capPx = Math.max(0, (capPadFactor || 0) * heightPx);
    
    	// desired *visible* span (including stroke caps for stroked styles)
    	const visibleSpan = Math.max(1, w * (Number.isFinite(widthFactor) ? widthFactor : 1));
    	// center the span within the line box
    	const leftEdge = (w - visibleSpan) / 2;
    
    	if (style === 'marker' || style === 'swoosh'){
    		const p = document.createElementNS(NS,'path');
    		p.setAttribute('class','uah-path');
    		p.setAttribute('d', def.d);
    		p.setAttribute('stroke-width', Math.max(1, heightPx));
    		p.setAttribute('vector-effect', 'non-scaling-stroke');
    		p.setAttribute('stroke-linecap', style === 'marker' ? 'square' : 'round');
    		p.setAttribute('stroke-linejoin','round');
    
    		// vertical scale (allow 0 via epsilon)
    		const kyEff = (ky === undefined || ky === null) ? 1 : Math.max(0, ky);
    		const sy = (h / def.vh) * (kyEff === 0 ? 1e-6 : kyEff);
    
    		// inner drawing width (path endpoints) after accounting for caps
    		const innerW = Math.max(1, visibleSpan - 2 * capPx);
    		// horizontal scale to fit the path viewport
    		const sx = innerW / def.vw;
    
    		// baseline alignment and horizontal placement:
    		// - start at leftEdge + capPx so visible stroke (with caps) spans 'visibleSpan'
    		const aY = Number.isFinite(anchorY) ? anchorY : 0;
    		const ty = yBase - (aY * sy);
    		const tx = leftEdge + capPx;
    
    		let pre = '';
    		if (dir === 'rtl') pre = ` translate(${def.vw} 0) scale(-1 1)`;
    
    		g.setAttribute('transform', `translate(${tx} ${ty})${pre} scale(${sx} ${sy})`);
    		g.appendChild(p);
    	} else {
    		// line (filled rect): no caps to account for; draw the full 'visibleSpan'
    		const r = document.createElementNS(NS,'rect');
    		const height = Math.max(1, heightPx);
    		const y = clamp(yBase - height/2, 0, h - height);
    
    		r.setAttribute('x', leftEdge);
    		r.setAttribute('y', y);
    		r.setAttribute('width', visibleSpan);
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
		
		let curveMarker = parseFloat(cs.getPropertyValue('--uah-curve-marker'));
        if (!Number.isFinite(curveMarker)) curveMarker = 0.05; else curveMarker = Math.max(0, curveMarker);
        
        let curveSwoosh = parseFloat(cs.getPropertyValue('--uah-curve-swoosh'));
        if (!Number.isFinite(curveSwoosh)) curveSwoosh = 0.28; else curveSwoosh = Math.max(0, curveSwoosh);
        
        let widthFactor = parseFloat(cs.getPropertyValue('--uah-width'));
        if (!Number.isFinite(widthFactor)) widthFactor = 1;
        widthFactor = Math.min(1.2, Math.max(0.5, widthFactor));

		const capPadFactor = parseFloat(cs.getPropertyValue('--uah-cap-pad')) || 0.5;

		// Set default highlight style.
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
			
			
			// ensure our coordinates are in the same px space as the SVG
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
            
            // extra horizontal reach when width > 1 (per side)
            const overhang = Math.max(0, (r.width * widthFactor - r.width) / 2);
			
			// generous padding so strokes never clip, even with offset/tilt/overhang
            const padX = Math.ceil(r.height * 1.2 + Math.abs(offsetPx) + heightPx * 3 + 16 + overhang);
            const padY = Math.ceil(r.height * 1.2 + Math.abs(offsetPx) + heightPx * 3 + 16);
            
            // expand the mask region itself — browsers clip to these bounds
            mask.setAttribute('x', -padX);
            mask.setAttribute('y', -padY);
            mask.setAttribute('width', r.width + padX * 2);
            mask.setAttribute('height', r.height + padY * 2);
            
            // reveal group scales from 0 -> 1 (LTR) or 1 -> 0 (RTL via origin)
			const reveal = document.createElementNS(NS, 'g');
			reveal.setAttribute('class','uah-reveal');
			reveal.style.transformOrigin = (dir === 'rtl') ? '100% 50%' : '0% 50%';

			// white rect fills the whole (padded) mask region
            const white = document.createElementNS(NS, 'rect');
            white.setAttribute('x', -padX);
            white.setAttribute('y', -padY);
            white.setAttribute('width', r.width + padX * 2);
            white.setAttribute('height', r.height + padY * 2);
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
			
			// cap inset in px (from your shrink-to-fit logic)
            const capPadPx = (capPadFactor || 0) * heightPx;

			// geometry group
			const anchorY = anchorFor(styleName);
			const geo = buildShapeGroup(def, styleName, r.width, r.height, yBase, heightPx, dir, ky, capPadFactor, widthFactor, anchorY);
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
