<svelte:window bind:innerWidth bind:innerHeight />
<svelte:body on:keydown={close} />

<div
	use:lock={lockOptions}
	use:rect={{ open, innerWidth, innerHeight, fs }}
	on:click={() => (open = true)}
	class:morph-open={open}
	class="morph-trigger"
	style="transition: visibility {(duration * 0.2) / 1000}s {(duration * 0.8) / 1000}s;"
>
	<slot>
		<button type="button">To replace trigger use default slot</button>
	</slot>
</div>

{#if open}
	{#if overlay}
		<div
			transition:fade={{ duration }}
			on:click={() => (open = false)}
			class="morph-overlay"
		/>
	{/if}
	<div
		transition:morph={{ from, duration }}
		class:morph-sm={fullscreen === 'mobile'}
		class:morph-fs={fs}
		class="morph-modal"
		style="width:{width}; height:{height}; margin-left: calc(-{width}/2);
    margin-top: calc(-{height}/2); "
	>
		<div in:blur={{ duration }} out:blur={{ duration }}>
			<slot name="content">To replace content use `content` slot</slot>
		</div>
	</div>
{/if}

<script>
	import { createEventDispatcher } from 'svelte';
	import { fade, blur } from 'svelte/transition';

	import morph from 'svelte-transitions-morph';

	import lock from './lockScroll.js';

	const dispatch = createEventDispatcher();

	let fullscreen = 'auto', // true (always), false (never), 'mobile', 'auto'
		height = '300px',
		width = '500px',
		lockScroll = true,
		overlay = true,
		open = false,
		duration = 800,
		esc = true,
		innerHeight,
		innerWidth,
		from;

	function rect(node) {
		function update() {
			from = node.firstChild.getBoundingClientRect();
		}
		update();
		return { update };
	}

	$: fs =
		fullscreen === true ||
		(fullscreen === 'auto' && parseFloat(width) > innerWidth);

	$: lockOptions = {
		enable: lockScroll && open,
		innerHeight,
	};

	$: dispatch('toggle', open);
	$: dispatch('adjust', fs);

	function close(e) {
		if (esc && open && (e.keyCode || e.which) == 27) {
			e.stopImmediatePropagation();
			e.stopPropagation();
			e.preventDefault();
			open = false;
		}
	}

	export {
		duration as speed,
		fullscreen,
		lockScroll,
		overlay,
		height,
		width,
		open,
		esc,
	};
</script>

<style>
	.morph-overlay {
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 800;
		position: fixed;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(5px);
	}
	.morph-modal {
		top: 50%;
		left: 50%;
		z-index: 900;
		position: fixed;
		overflow: auto;
		transform-origin: 0 0;
	}
	.morph-modal > div {
		width: 100%;
		height: 100%;
		position: relative;
	}
	.morph-modal.morph-fs {
		top: 0% !important;
		left: 0% !important;
		margin: 0 !important;
		width: 100% !important;
		height: 100% !important;
		transform: none !important;
	}
	.morph-trigger {
		display: contents;
	}
	.morph-trigger.morph-open {
		visibility: hidden;
		pointer-events: none;
		transition: visibility 0.1s !important;
	}
	@media screen and (max-width: 600px) {
		.morph-modal.morph-sm {
			top: 0% !important;
			left: 0% !important;
			margin: 0 !important;
			width: 100% !important;
			height: 100% !important;
			transform: none !important;
		}
	}
</style>
