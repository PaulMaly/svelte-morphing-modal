# svelte-morphing-modal changelog

## 2.2.0
* (BREAKING CHANGE): Remove click handler from `trigger` wrapper. Seems opening should be managed by parent component. Now you should always use `open` prop to show/hide modal content.

## 2.1.1
* Remove forgotten `console.log`.
* Add `no-console` to eslint.

## 2.1.0
* Improve bounting rect tracking.
* Change opacity to visibility to hide trigger.

## 2.0.0
* (BREAKING CHANGE): Now `trigget` slot become a default slot, put you content using `content` slot.
* (BREAKING CHANGE): Use `display: contents` to trigger wrapping element.
* Use more specific classes to prevent downstream cascade. 
* Update & fix dependencies.
* Formating via Prettier.
* Add simple README.

## 1.3.1
* Fix `lockScroll` enabled.
* Add bundles to git.

## 1.3.0
* Implement scroll disabling when modal is open & `lockScroll` prop.
* Rename `change` event to `toggle` event.
* Dispatch `adjust` event when modal has switched between fullscreen and window mode
* Blur effect for overlay.

## 1.2.1
* Replace custom `blur` transition with new built-in. 
* Dispatch `change` event any time open state changed.

## 1.2.0
* Update to latest Svelte 3.
* Few re-writes.
* README & CHANGELOG added.
* eslint, editorconfig added.

## 1.0.0

* First release
