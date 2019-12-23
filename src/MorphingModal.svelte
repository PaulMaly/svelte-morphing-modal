<svelte:window bind:innerWidth />
<svelte:body on:keydown={close} />

<div
	bind:this={trigger}
	on:click={() => open = true}
	class:open
	class="trigger"
	style="transition: opacity {duration * 0.2 / 1000}s {duration * 0.8 / 1000}s;"
>
	<slot name="trigger">
		<button type="button">To replace trigger use 'trigger' slot</button>
	</slot>
</div>

{#if open}
	{#if overlay}
	<div
		transition:fade={{ duration }}
		on:click={() => open = false}
		class="overlay"
	></div>
	{/if}
	<div
		transition:morph={{ from, duration }}
		class:sm={fullscreen === 'mobile'}
		class:fs
		class="modal"
		style="
			width:{width}; height:{height};
			margin-left: calc(-{width}/2);
			margin-top: calc(-{height}/2);
		"
	>
		<div
			in:blur={{ duration }}
			out:blur={{ duration }}
		>
			<slot>To replace content use default slot</slot>
		</div>
	</div>
{/if}

<script>
	import { afterUpdate, createEventDispatcher } from 'svelte';
	import { fade, blur } from 'svelte/transition';

	import morph from 'svelte-transitions-morph';

	const dispatch = createEventDispatcher();

	let fullscreen = 'auto', // true (always), false (never), 'mobile', 'auto'
		height = '300px',
		width = '500px',
		overlay = true,
		open = false,
		duration = 800,
		esc = true,
		innerWidth,
		trigger,
		from;

	afterUpdate(() => {
		from = trigger.getBoundingClientRect();
	});

	$: fs = fullscreen === true || (fullscreen === 'auto' && parseFloat(width) > innerWidth);
	$: dispatch('change', open);

	function close(e) {
		if (esc && open && (e.keyCode || e.which) == 27) {
			e.stopImmediatePropagation();
			e.stopPropagation();
			e.preventDefault();
			open = false;
		}
	}

	export { open, overlay, esc, fullscreen, height, width, duration as speed };
</script>

<style>
	.overlay {
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 800;
		position: fixed;
		overflow: hidden;
		background: rgba(0, 0, 0, .5);
	}
	.modal {
		top: 50%;
		left: 50%;
		z-index: 900;
		position: fixed;
		overflow: hidden;
		transform-origin: 0 0;
	}
	.modal > div {
		width: 100%;
		height: 100%;
		position: relative;
	}
	.modal.fs {
			top: 0% !important;
			left: 0% !important;
			margin: 0 !important;
			width: 100% !important;
			height: 100% !important;
			transform: none !important;
	}
	.trigger { display: inline-block; }
	.trigger.open {
		opacity: 0;
		pointer-events: none;
		transition: opacity .1s !important;
	}
	@media screen and (max-width: 600px) {
		.modal.sm {
			top: 0% !important;
			left: 0% !important;
			margin: 0 !important;
			width: 100% !important;
			height: 100% !important;
			transform: none !important;
		}
	}
</style>
