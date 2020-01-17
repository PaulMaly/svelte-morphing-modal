const style = `width:99px;height:99px;position:absolute;top:-9999px;overflow:scroll;`;

export default function(node, values) {
	let doc = document.documentElement;

	let div = document.createElement('div');
	div.setAttribute('style', style);
	doc.appendChild(div);
	let scrollbarSize = div.offsetWidth - div.clientWidth;
	doc.removeChild(div);

	let enabled = false, scrollTop, hasScroll;

	function update({ enable = false, innerHeight = window.innerHeight }) {
		if (
			enabled === (enabled = enable) &&
			hasScroll === (hasScroll = doc.scrollHeight > innerHeight)
		) return;

		if (enabled) {
			scrollTop = window.pageYOffset;
			if (hasScroll) {
				doc.style.width = `calc(100% - ${scrollbarSize}px)`;
			} else {
				doc.style.width = '100%';
			}
			doc.style.position = 'fixed';
			doc.style.top = -scrollTop + 'px';
			doc.style.overflow = 'hidden';
		} else {
			destroy();
		}
	}

	function destroy() {
		doc.style.width = '';
		doc.style.position = '';
		doc.style.top = '';
		doc.style.overflow = '';
		window.scroll(0, scrollTop);
	}

	update(values);

	return { update, destroy };
}
