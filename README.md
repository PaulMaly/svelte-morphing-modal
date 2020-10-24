# Svelte Morphing Modal for Svelte 3 [demo](https://svelte.dev/repl/ed678672e4cc43ad9e0538710d02fba2?version=3)

[![NPM version](https://img.shields.io/npm/v/svelte-morphing-modal.svg?style=flat)](https://www.npmjs.com/package/svelte-morphing-modal) [![NPM downloads](https://img.shields.io/npm/dm/svelte-morphing-modal.svg?style=flat)](https://www.npmjs.com/package/svelte-morphing-modal)

Simple modal layout with morphing transition from trigger element to modal content.

## Features

- Any modal contents - just a layout, you able to put anithing in it!
- Fullscreen mode (auto, always, mobile only)
- Overlay mode with click to close.
- Auto close on `esc` key.
- Lock scroll mode.
- Simple open/close (just a prop).

## Install

```bash
npm i svelte-morphing-modal --save-dev
```

```bash
yarn add svelte-morphing-modal
```

CDN: [UNPKG](https://unpkg.com/svelte-morphing-modal/) | [jsDelivr](https://cdn.jsdelivr.net/npm/svelte-morphing-modal/) (available as `window.MorphingModal`)

## Usage

```svelte
<MorphingModal {open}>
	<button>Open modal</button>
	<div slot="content">
        <p>Modal content</p>
    </div>
</MorphingModal>

<script>
    import MorphingModal from 'svelte-morphing-modal';

    let open
</script>
```

If you are **not** using using es6, instead of importing add 

```html
<script src="/path/to/svelte-morphing-modal/index.js"></script>
```

just before closing body tag.

## License

MIT &copy; [PaulMaly](https://github.com/PaulMaly)

