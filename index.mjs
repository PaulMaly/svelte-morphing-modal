function noop() { }
const identity = x => x;
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function action_destroyer(action_result) {
    return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? 'important' : '');
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

let stylesheet;
let active = 0;
let current_rules = {};
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    if (!current_rules[name]) {
        if (!stylesheet) {
            const style = element('style');
            document.head.appendChild(style);
            stylesheet = style.sheet;
        }
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    node.style.animation = (node.style.animation || '')
        .split(', ')
        .filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    )
        .join(', ');
    if (name && !--active)
        clear_rules();
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        let i = stylesheet.cssRules.length;
        while (i--)
            stylesheet.deleteRule(i);
        current_rules = {};
    });
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
    return current_component;
}
function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
const null_transition = { duration: 0 };
function create_in_transition(node, fn, params) {
    let config = fn(node, params);
    let running = false;
    let animation_name;
    let task;
    let uid = 0;
    function cleanup() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
        tick(0, 1);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        if (task)
            task.abort();
        running = true;
        add_render_callback(() => dispatch(node, true, 'start'));
        task = loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(1, 0);
                    dispatch(node, true, 'end');
                    cleanup();
                    return running = false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(t, 1 - t);
                }
            }
            return running;
        });
    }
    let started = false;
    return {
        start() {
            if (started)
                return;
            delete_rule(node);
            if (is_function(config)) {
                config = config();
                wait().then(go);
            }
            else {
                go();
            }
        },
        invalidate() {
            started = false;
        },
        end() {
            if (running) {
                cleanup();
                running = false;
            }
        }
    };
}
function create_out_transition(node, fn, params) {
    let config = fn(node, params);
    let running = true;
    let animation_name;
    const group = outros;
    group.r += 1;
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        add_render_callback(() => dispatch(node, false, 'start'));
        loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(0, 1);
                    dispatch(node, false, 'end');
                    if (!--group.r) {
                        // this will result in `end()` being called,
                        // so we don't need to clean up here
                        run_all(group.c);
                    }
                    return false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(1 - t, t);
                }
            }
            return running;
        });
    }
    if (is_function(config)) {
        wait().then(() => {
            // @ts-ignore
            config = config();
            go();
        });
    }
    else {
        go();
    }
    return {
        end(reset) {
            if (reset && config.tick) {
                config.tick(1, 0);
            }
            if (running) {
                if (animation_name)
                    delete_rule(node, animation_name);
                running = false;
            }
        }
    };
}
function create_bidirectional_transition(node, fn, params, intro) {
    let config = fn(node, params);
    let t = intro ? 0 : 1;
    let running_program = null;
    let pending_program = null;
    let animation_name = null;
    function clear_animation() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function init(program, duration) {
        const d = program.b - t;
        duration *= Math.abs(d);
        return {
            a: t,
            b: program.b,
            d,
            duration,
            start: program.start,
            end: program.start + duration,
            group: program.group
        };
    }
    function go(b) {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        const program = {
            start: now() + delay,
            b
        };
        if (!b) {
            // @ts-ignore todo: improve typings
            program.group = outros;
            outros.r += 1;
        }
        if (running_program) {
            pending_program = program;
        }
        else {
            // if this is an intro, and there's a delay, we need to do
            // an initial tick and/or apply CSS animation immediately
            if (css) {
                clear_animation();
                animation_name = create_rule(node, t, b, duration, delay, easing, css);
            }
            if (b)
                tick(0, 1);
            running_program = init(program, duration);
            add_render_callback(() => dispatch(node, b, 'start'));
            loop(now => {
                if (pending_program && now > pending_program.start) {
                    running_program = init(pending_program, duration);
                    pending_program = null;
                    dispatch(node, running_program.b, 'start');
                    if (css) {
                        clear_animation();
                        animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                    }
                }
                if (running_program) {
                    if (now >= running_program.end) {
                        tick(t = running_program.b, 1 - t);
                        dispatch(node, running_program.b, 'end');
                        if (!pending_program) {
                            // we're done
                            if (running_program.b) {
                                // intro — we can tidy up immediately
                                clear_animation();
                            }
                            else {
                                // outro — needs to be coordinated
                                if (!--running_program.group.r)
                                    run_all(running_program.group.c);
                            }
                        }
                        running_program = null;
                    }
                    else if (now >= running_program.start) {
                        const p = now - running_program.start;
                        t = running_program.a + running_program.d * easing(p / running_program.duration);
                        tick(t, 1 - t);
                    }
                }
                return !!(running_program || pending_program);
            });
        }
    }
    return {
        run(b) {
            if (is_function(config)) {
                wait().then(() => {
                    // @ts-ignore
                    config = config();
                    go(b);
                });
            }
            else {
                go(b);
            }
        },
        end() {
            clear_animation();
            running_program = pending_program = null;
        }
    };
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const prop_values = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, prop_values, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if ($$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(children(options.target));
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set() {
        // overridden by instance, if it has props
    }
}

function cubicInOut(t) {
    return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
}

function blur(node, { delay = 0, duration = 400, easing = cubicInOut, amount = 5, opacity = 0 }) {
    const style = getComputedStyle(node);
    const target_opacity = +style.opacity;
    const f = style.filter === 'none' ? '' : style.filter;
    const od = target_opacity * (1 - opacity);
    return {
        delay,
        duration,
        easing,
        css: (_t, u) => `opacity: ${target_opacity - (od * u)}; filter: ${f} blur(${u * amount}px);`
    };
}
function fade(node, { delay = 0, duration = 400, easing = identity }) {
    const o = +getComputedStyle(node).opacity;
    return {
        delay,
        duration,
        easing,
        css: t => `opacity: ${t * o}`
    };
}

function morph(node, params) {
	const {
			delay = 0,
			duration = 400,
			easing = t => 1 - Math.pow(1 - t, 3),
			from = { left: 0, top: 0, width: 0, height: 0 }
		} = params,
		to = node.getBoundingClientRect(),
		ty = from.top - to.top,
		tx = from.left - to.left,
		sx = from.width / to.width - 1,
		sy = from.height / to.height - 1;

	return {
		delay,
		easing,
		duration,
		css: (t, u) => {
			return `
				transform: 
					translate(${u * tx}px, ${u * ty}px) 
					scale(${1 + u * sx}, ${1 + u * sy});
			`;
		}
	};
}

const style = `width:99px;height:99px;position:absolute;top:-9999px;overflow:scroll;`;

function lock(node, values) {
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
			setTimeout(() => {
				scrollTop = window.pageYOffset;
				if (hasScroll) {
					doc.style.width = `calc(100% - ${scrollbarSize}px)`;
				} else {
					doc.style.width = '100%';
				}
				doc.style.position = 'fixed';
				doc.style.top = -scrollTop + 'px';
				doc.style.overflow = 'hidden';
			});
		} else {
			setTimeout(destroy);
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

/* src/MorphingModal.svelte generated by Svelte v3.19.2 */

function add_css() {
	var style = element("style");
	style.id = "svelte-bukqbm-style";
	style.textContent = ".overlay.svelte-bukqbm.svelte-bukqbm{top:0;left:0;width:100%;height:100%;z-index:800;position:fixed;overflow:hidden;background:rgba(0, 0, 0, 0.5);backdrop-filter:blur(5px)}.modal.svelte-bukqbm.svelte-bukqbm{top:50%;left:50%;z-index:900;position:fixed;overflow:auto;transform-origin:0 0}.modal.svelte-bukqbm>div.svelte-bukqbm{width:100%;height:100%;position:relative}.modal.fs.svelte-bukqbm.svelte-bukqbm{top:0% !important;left:0% !important;margin:0 !important;width:100% !important;height:100% !important;transform:none !important}.trigger.svelte-bukqbm.svelte-bukqbm{display:inline-block}.trigger.open.svelte-bukqbm.svelte-bukqbm{opacity:0;pointer-events:none;transition:opacity 0.1s !important}@media screen and (max-width: 600px){.modal.sm.svelte-bukqbm.svelte-bukqbm{top:0% !important;left:0% !important;margin:0 !important;width:100% !important;height:100% !important;transform:none !important}}";
	append(document.head, style);
}

const get_trigger_slot_changes = dirty => ({});
const get_trigger_slot_context = ctx => ({});

// (129:0) {#if open}
function create_if_block(ctx) {
	let t0;
	let div1;
	let div0;
	let t1;
	let div0_intro;
	let div0_outro;
	let div1_transition;
	let current;
	let if_block = /*overlay*/ ctx[4] && create_if_block_1(ctx);
	const default_slot_template = /*$$slots*/ ctx[17].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

	return {
		c() {
			if (if_block) if_block.c();
			t0 = space();
			div1 = element("div");
			div0 = element("div");

			if (!default_slot) {
				t1 = text("To replace content use default slot");
			}

			if (default_slot) default_slot.c();
			attr(div0, "class", "svelte-bukqbm");
			attr(div1, "class", "modal svelte-bukqbm");
			set_style(div1, "width", /*width*/ ctx[3]);
			set_style(div1, "height", /*height*/ ctx[2]);
			set_style(div1, "margin-left", "calc(-" + /*width*/ ctx[3] + "/2)");
			set_style(div1, "margin-top", "calc(-" + /*height*/ ctx[2] + "/2)");
			toggle_class(div1, "sm", /*fullscreen*/ ctx[1] === "mobile");
			toggle_class(div1, "fs", /*fs*/ ctx[10]);
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, t0, anchor);
			insert(target, div1, anchor);
			append(div1, div0);

			if (!default_slot) {
				append(div0, t1);
			}

			if (default_slot) {
				default_slot.m(div0, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (/*overlay*/ ctx[4]) {
				if (if_block) {
					if_block.p(ctx, dirty);
					transition_in(if_block, 1);
				} else {
					if_block = create_if_block_1(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(t0.parentNode, t0);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}

			if (default_slot && default_slot.p && dirty & /*$$scope*/ 65536) {
				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[16], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[16], dirty, null));
			}

			if (!current || dirty & /*width*/ 8) {
				set_style(div1, "width", /*width*/ ctx[3]);
			}

			if (!current || dirty & /*height*/ 4) {
				set_style(div1, "height", /*height*/ ctx[2]);
			}

			if (!current || dirty & /*width*/ 8) {
				set_style(div1, "margin-left", "calc(-" + /*width*/ ctx[3] + "/2)");
			}

			if (!current || dirty & /*height*/ 4) {
				set_style(div1, "margin-top", "calc(-" + /*height*/ ctx[2] + "/2)");
			}

			if (dirty & /*fullscreen*/ 2) {
				toggle_class(div1, "sm", /*fullscreen*/ ctx[1] === "mobile");
			}

			if (dirty & /*fs*/ 1024) {
				toggle_class(div1, "fs", /*fs*/ ctx[10]);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			transition_in(default_slot, local);

			add_render_callback(() => {
				if (div0_outro) div0_outro.end(1);
				if (!div0_intro) div0_intro = create_in_transition(div0, blur, { duration: /*duration*/ ctx[5] });
				div0_intro.start();
			});

			add_render_callback(() => {
				if (!div1_transition) div1_transition = create_bidirectional_transition(
					div1,
					morph,
					{
						from: /*from*/ ctx[9],
						duration: /*duration*/ ctx[5]
					},
					true
				);

				div1_transition.run(1);
			});

			current = true;
		},
		o(local) {
			transition_out(if_block);
			transition_out(default_slot, local);
			if (div0_intro) div0_intro.invalidate();
			div0_outro = create_out_transition(div0, blur, { duration: /*duration*/ ctx[5] });

			if (!div1_transition) div1_transition = create_bidirectional_transition(
				div1,
				morph,
				{
					from: /*from*/ ctx[9],
					duration: /*duration*/ ctx[5]
				},
				false
			);

			div1_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(t0);
			if (detaching) detach(div1);
			if (default_slot) default_slot.d(detaching);
			if (detaching && div0_outro) div0_outro.end();
			if (detaching && div1_transition) div1_transition.end();
		}
	};
}

// (130:2) {#if overlay}
function create_if_block_1(ctx) {
	let div;
	let div_transition;
	let current;
	let dispose;

	return {
		c() {
			div = element("div");
			attr(div, "class", "overlay svelte-bukqbm");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			current = true;
			dispose = listen(div, "click", /*click_handler_1*/ ctx[21]);
		},
		p: noop,
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: /*duration*/ ctx[5] }, true);
				div_transition.run(1);
			});

			current = true;
		},
		o(local) {
			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: /*duration*/ ctx[5] }, false);
			div_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (detaching && div_transition) div_transition.end();
			dispose();
		}
	};
}

function create_fragment(ctx) {
	let t0;
	let div;
	let button;
	let lock_action;
	let t2;
	let if_block_anchor;
	let current;
	let dispose;
	add_render_callback(/*onwindowresize*/ ctx[18]);
	const trigger_slot_template = /*$$slots*/ ctx[17].trigger;
	const trigger_slot = create_slot(trigger_slot_template, ctx, /*$$scope*/ ctx[16], get_trigger_slot_context);
	let if_block = /*open*/ ctx[0] && create_if_block(ctx);

	return {
		c() {
			t0 = space();
			div = element("div");

			if (!trigger_slot) {
				button = element("button");
				button.textContent = "To replace trigger use 'trigger' slot";
			}

			if (trigger_slot) trigger_slot.c();
			t2 = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();

			if (!trigger_slot) {
				attr(button, "type", "button");
			}

			attr(div, "class", "trigger svelte-bukqbm");
			set_style(div, "transition", "opacity " + /*duration*/ ctx[5] * 0.2 / 1000 + "s " + /*duration*/ ctx[5] * 0.8 / 1000 + "s");
			toggle_class(div, "open", /*open*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, div, anchor);

			if (!trigger_slot) {
				append(div, button);
			}

			if (trigger_slot) {
				trigger_slot.m(div, null);
			}

			/*div_binding*/ ctx[19](div);
			insert(target, t2, anchor);
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;

			dispose = [
				listen(window, "resize", /*onwindowresize*/ ctx[18]),
				listen(document.body, "keydown", /*close*/ ctx[12]),
				action_destroyer(lock_action = lock.call(null, div, /*lockOptions*/ ctx[11])),
				listen(div, "click", /*click_handler*/ ctx[20])
			];
		},
		p(ctx, [dirty]) {
			if (trigger_slot && trigger_slot.p && dirty & /*$$scope*/ 65536) {
				trigger_slot.p(get_slot_context(trigger_slot_template, ctx, /*$$scope*/ ctx[16], get_trigger_slot_context), get_slot_changes(trigger_slot_template, /*$$scope*/ ctx[16], dirty, get_trigger_slot_changes));
			}

			if (!current || dirty & /*duration*/ 32) {
				set_style(div, "transition", "opacity " + /*duration*/ ctx[5] * 0.2 / 1000 + "s " + /*duration*/ ctx[5] * 0.8 / 1000 + "s");
			}

			if (lock_action && is_function(lock_action.update) && dirty & /*lockOptions*/ 2048) lock_action.update.call(null, /*lockOptions*/ ctx[11]);

			if (dirty & /*open*/ 1) {
				toggle_class(div, "open", /*open*/ ctx[0]);
			}

			if (/*open*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);
					transition_in(if_block, 1);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(trigger_slot, local);
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(trigger_slot, local);
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(t0);
			if (detaching) detach(div);
			if (trigger_slot) trigger_slot.d(detaching);
			/*div_binding*/ ctx[19](null);
			if (detaching) detach(t2);
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	const dispatch = createEventDispatcher();

	let { fullscreen = "auto" } = $$props,
		{ height = "300px" } = $$props,
		{ width = "500px" } = $$props,
		{ lockScroll = true } = $$props,
		{ overlay = true } = $$props,
		{ open = false } = $$props,
		{ speed: duration = 800 } = $$props,
		{ esc = true } = $$props,
		innerHeight,
		innerWidth,
		trigger,
		from; // true (always), false (never), 'mobile', 'auto'

	afterUpdate(() => {
		$$invalidate(9, from = trigger.getBoundingClientRect());
	});

	function close(e) {
		if (esc && open && (e.keyCode || e.which) == 27) {
			e.stopImmediatePropagation();
			e.stopPropagation();
			e.preventDefault();
			$$invalidate(0, open = false);
		}
	}

	let { $$slots = {}, $$scope } = $$props;

	function onwindowresize() {
		$$invalidate(7, innerWidth = window.innerWidth);
		$$invalidate(6, innerHeight = window.innerHeight);
	}

	function div_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			$$invalidate(8, trigger = $$value);
		});
	}

	const click_handler = () => $$invalidate(0, open = true);
	const click_handler_1 = () => $$invalidate(0, open = false);

	$$self.$set = $$props => {
		if ("fullscreen" in $$props) $$invalidate(1, fullscreen = $$props.fullscreen);
		if ("height" in $$props) $$invalidate(2, height = $$props.height);
		if ("width" in $$props) $$invalidate(3, width = $$props.width);
		if ("lockScroll" in $$props) $$invalidate(13, lockScroll = $$props.lockScroll);
		if ("overlay" in $$props) $$invalidate(4, overlay = $$props.overlay);
		if ("open" in $$props) $$invalidate(0, open = $$props.open);
		if ("speed" in $$props) $$invalidate(5, duration = $$props.speed);
		if ("esc" in $$props) $$invalidate(14, esc = $$props.esc);
		if ("$$scope" in $$props) $$invalidate(16, $$scope = $$props.$$scope);
	};

	let fs;
	let lockOptions;

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*fullscreen, width, innerWidth*/ 138) {
			 $$invalidate(10, fs = fullscreen === true || fullscreen === "auto" && parseFloat(width) > innerWidth);
		}

		if ($$self.$$.dirty & /*lockScroll, open, innerHeight*/ 8257) {
			 $$invalidate(11, lockOptions = { enable: lockScroll && open, innerHeight });
		}

		if ($$self.$$.dirty & /*open*/ 1) {
			 dispatch("toggle", open);
		}

		if ($$self.$$.dirty & /*fs*/ 1024) {
			 dispatch("adjust", fs);
		}
	};

	return [
		open,
		fullscreen,
		height,
		width,
		overlay,
		duration,
		innerHeight,
		innerWidth,
		trigger,
		from,
		fs,
		lockOptions,
		close,
		lockScroll,
		esc,
		dispatch,
		$$scope,
		$$slots,
		onwindowresize,
		div_binding,
		click_handler,
		click_handler_1
	];
}

class MorphingModal extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-bukqbm-style")) add_css();

		init(this, options, instance, create_fragment, safe_not_equal, {
			fullscreen: 1,
			height: 2,
			width: 3,
			lockScroll: 13,
			overlay: 4,
			open: 0,
			speed: 5,
			esc: 14
		});
	}
}

export default MorphingModal;
