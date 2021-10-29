
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
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
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
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
            set_current_component(null);
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
    const outroing = new Set();
    let outros;
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
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
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
        }
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
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
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
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
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
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
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\Bird.svelte generated by Svelte v3.44.0 */

    const file$3 = "src\\Bird.svelte";

    function create_fragment$3(ctx) {
    	let section;

    	const block = {
    		c: function create() {
    			section = element("section");
    			set_style(section, "height", /*bird*/ ctx[0].size + "px");
    			set_style(section, "width", /*bird*/ ctx[0].size + "px");
    			set_style(section, "left", /*bird*/ ctx[0].left + "px");
    			set_style(section, "top", /*bird*/ ctx[0].top + "px");
    			attr_dev(section, "id", "bird");
    			attr_dev(section, "class", "svelte-1vr9409");
    			add_location(section, file$3, 11, 0, 172);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*bird*/ 1) {
    				set_style(section, "height", /*bird*/ ctx[0].size + "px");
    			}

    			if (dirty & /*bird*/ 1) {
    				set_style(section, "width", /*bird*/ ctx[0].size + "px");
    			}

    			if (dirty & /*bird*/ 1) {
    				set_style(section, "left", /*bird*/ ctx[0].left + "px");
    			}

    			if (dirty & /*bird*/ 1) {
    				set_style(section, "top", /*bird*/ ctx[0].top + "px");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Bird', slots, []);
    	let { bird } = $$props;
    	const writable_props = ['bird'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Bird> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('bird' in $$props) $$invalidate(0, bird = $$props.bird);
    	};

    	$$self.$capture_state = () => ({ bird });

    	$$self.$inject_state = $$props => {
    		if ('bird' in $$props) $$invalidate(0, bird = $$props.bird);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [bird];
    }

    class Bird extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { bird: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bird",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*bird*/ ctx[0] === undefined && !('bird' in props)) {
    			console.warn("<Bird> was created without expected prop 'bird'");
    		}
    	}

    	get bird() {
    		throw new Error("<Bird>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bird(value) {
    		throw new Error("<Bird>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    class GameController {
        constructor(height = 600, width = 300, pipeWidth = 50, pipeGap = 150, minTopForTopPipe = 70, maxTopForTopPipe = 350, generateNewPipePercent = 0.7, speed = 1, groundHeight = 20, birdX = 40, birdSize = 20, gravity = 1.5, jumpVelocity = 10, slowVelocityBy = 0.3) {
            this.height = height;
            this.width = width;
            this.pipeWidth = pipeWidth;
            this.pipeGap = pipeGap;
            this.minTopForTopPipe = minTopForTopPipe;
            this.maxTopForTopPipe = maxTopForTopPipe;
            this.generateNewPipePercent = generateNewPipePercent;
            this.speed = speed;
            this.groundHeight = groundHeight;
            this.birdX = birdX;
            this.birdSize = birdSize;
            this.gravity = gravity;
            this.jumpVelocity = jumpVelocity;
            this.slowVelocityBy = slowVelocityBy;
            this.velocity = 0;
        }
        newGame() {
            let firstPipe = this.createPipe(true);
            let secondPipe = this.createPipe(false);
            this.frame = {
                score: 0,
                height: this.height,
                width: this.width,
                gameOver: false,
                gameStarted: false,
                firstPipe,
                secondPipe,
                ground: {
                    height: this.groundHeight,
                },
                bird: {
                    left: this.birdX,
                    top: this.height / 2 - this.birdSize / 2,
                    size: this.birdSize,
                },
            };
            return this.frame;
        }
        nextFrame() {
            if (this.frame.gameOver || !this.frame.gameStarted) {
                return this.frame;
            }
            this.frame.firstPipe = this.movePipe(this.frame.firstPipe, this.frame.secondPipe);
            this.frame.secondPipe = this.movePipe(this.frame.secondPipe, this.frame.firstPipe);
            if (this.frame.bird.top >=
                this.height - this.groundHeight - this.birdSize) {
                this.frame.bird.top = this.height - this.groundHeight - this.birdSize;
                this.frame.gameOver = true;
                return this.frame;
            }
            if (this.hasCollidedWithPipe()) {
                this.frame.gameOver = true;
                return this.frame;
            }
            if (this.velocity > 0) {
                this.velocity -= this.slowVelocityBy;
            }
            this.frame.bird.top += Math.pow(this.gravity, 2) - this.velocity;
            if (this.frame.firstPipe.left + this.pipeWidth == this.birdX - this.speed) {
                this.frame.score += 1;
            }
            if (this.frame.secondPipe.left + this.pipeWidth ==
                this.birdX - this.speed) {
                this.frame.score += 1;
            }
            return this.frame;
        }
        hasCollidedWithPipe() {
            if (this.frame.firstPipe.show &&
                this.checkPipe(this.frame.firstPipe.left)) {
                return !(this.frame.bird.top > this.frame.firstPipe.topPipe.height &&
                    this.frame.bird.top + this.birdSize <
                        this.frame.firstPipe.bottomPipe.top);
            }
            if (this.frame.secondPipe.show &&
                this.checkPipe(this.frame.secondPipe.left)) {
                return !(this.frame.bird.top > this.frame.secondPipe.topPipe.height &&
                    this.frame.bird.top + this.birdSize <
                        this.frame.secondPipe.bottomPipe.top);
            }
            return false;
        }
        checkPipe(left) {
            return (left <= this.birdX + this.birdSize && left + this.pipeWidth >= this.birdX);
        }
        start() {
            this.newGame();
            this.frame.gameStarted = true;
            return this.frame;
        }
        jump() {
            if (this.velocity <= 0) {
                this.velocity += this.jumpVelocity;
            }
        }
        randomYForTopPipe() {
            return (this.minTopForTopPipe +
                (this.maxTopForTopPipe - this.minTopForTopPipe) * Math.random());
        }
        createPipe(show) {
            const height = this.randomYForTopPipe();
            return {
                topPipe: {
                    height: height,
                    top: 0,
                },
                bottomPipe: {
                    top: height + this.pipeGap,
                    height: this.height,
                },
                left: this.width - this.pipeWidth,
                width: this.pipeWidth,
                show,
            };
        }
        movePipe(pipe, otherPipe) {
            if (pipe.show && pipe.left <= this.pipeWidth * -1) {
                pipe.show = false;
                return pipe;
            }
            if (pipe.show) {
                pipe.left -= this.speed;
            }
            if (otherPipe.left < this.width * (1 - this.generateNewPipePercent) &&
                otherPipe.show &&
                !pipe.show) {
                return this.createPipe(true);
            }
            return pipe;
        }
    }

    /* src\Pipe.svelte generated by Svelte v3.44.0 */

    const file$2 = "src\\Pipe.svelte";

    // (11:0) {#if pipe.show}
    function create_if_block$1(ctx) {
    	let section0;
    	let t;
    	let section1;

    	const block = {
    		c: function create() {
    			section0 = element("section");
    			t = space();
    			section1 = element("section");
    			set_style(section0, "left", /*pipe*/ ctx[0].left + "px");
    			set_style(section0, "top", /*pipe*/ ctx[0].topPipe.top + "px");
    			set_style(section0, "width", /*pipe*/ ctx[0].width + "px");
    			set_style(section0, "height", /*pipe*/ ctx[0].topPipe.height + "px");
    			attr_dev(section0, "class", "top-pipe pipe svelte-uaqcn8");
    			add_location(section0, file$2, 11, 0, 161);
    			set_style(section1, "left", /*pipe*/ ctx[0].left + "px");
    			set_style(section1, "top", /*pipe*/ ctx[0].bottomPipe.top + "px");
    			set_style(section1, "width", /*pipe*/ ctx[0].width + "px");
    			set_style(section1, "height", /*pipe*/ ctx[0].bottomPipe.height + "px");
    			attr_dev(section1, "class", "bottom-pipe pipe svelte-uaqcn8");
    			add_location(section1, file$2, 12, 0, 313);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section0, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, section1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*pipe*/ 1) {
    				set_style(section0, "left", /*pipe*/ ctx[0].left + "px");
    			}

    			if (dirty & /*pipe*/ 1) {
    				set_style(section0, "top", /*pipe*/ ctx[0].topPipe.top + "px");
    			}

    			if (dirty & /*pipe*/ 1) {
    				set_style(section0, "width", /*pipe*/ ctx[0].width + "px");
    			}

    			if (dirty & /*pipe*/ 1) {
    				set_style(section0, "height", /*pipe*/ ctx[0].topPipe.height + "px");
    			}

    			if (dirty & /*pipe*/ 1) {
    				set_style(section1, "left", /*pipe*/ ctx[0].left + "px");
    			}

    			if (dirty & /*pipe*/ 1) {
    				set_style(section1, "top", /*pipe*/ ctx[0].bottomPipe.top + "px");
    			}

    			if (dirty & /*pipe*/ 1) {
    				set_style(section1, "width", /*pipe*/ ctx[0].width + "px");
    			}

    			if (dirty & /*pipe*/ 1) {
    				set_style(section1, "height", /*pipe*/ ctx[0].bottomPipe.height + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section0);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(section1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(11:0) {#if pipe.show}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*pipe*/ ctx[0].show && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*pipe*/ ctx[0].show) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Pipe', slots, []);
    	let { pipe } = $$props;
    	const writable_props = ['pipe'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Pipe> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('pipe' in $$props) $$invalidate(0, pipe = $$props.pipe);
    	};

    	$$self.$capture_state = () => ({ pipe });

    	$$self.$inject_state = $$props => {
    		if ('pipe' in $$props) $$invalidate(0, pipe = $$props.pipe);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [pipe];
    }

    class Pipe extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { pipe: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pipe",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*pipe*/ ctx[0] === undefined && !('pipe' in props)) {
    			console.warn("<Pipe> was created without expected prop 'pipe'");
    		}
    	}

    	get pipe() {
    		throw new Error("<Pipe>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pipe(value) {
    		throw new Error("<Pipe>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Game.svelte generated by Svelte v3.44.0 */
    const file$1 = "src\\Game.svelte";

    // (86:2) {#if frame.gameOver || !frame.gameStarted }
    function create_if_block(ctx) {
    	let section;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;
    	let if_block = /*frame*/ ctx[0].gameOver && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			if (if_block) if_block.c();
    			t0 = space();
    			button = element("button");
    			button.textContent = "Start Game";
    			attr_dev(button, "class", "svelte-1xow2l5");
    			add_location(button, file$1, 91, 6, 1985);
    			attr_dev(section, "id", "init-screen");
    			attr_dev(section, "class", "svelte-1xow2l5");
    			add_location(section, file$1, 86, 4, 1843);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			if (if_block) if_block.m(section, null);
    			append_dev(section, t0);
    			append_dev(section, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*startGame*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*frame*/ ctx[0].gameOver) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(section, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(86:2) {#if frame.gameOver || !frame.gameStarted }",
    		ctx
    	});

    	return block;
    }

    // (88:6) {#if frame.gameOver}
    function create_if_block_1(ctx) {
    	let h20;
    	let t1;
    	let h21;
    	let t2;
    	let t3_value = /*frame*/ ctx[0].score + "";
    	let t3;

    	const block = {
    		c: function create() {
    			h20 = element("h2");
    			h20.textContent = "Game Over";
    			t1 = space();
    			h21 = element("h2");
    			t2 = text("Score: ");
    			t3 = text(t3_value);
    			attr_dev(h20, "class", "svelte-1xow2l5");
    			add_location(h20, file$1, 88, 8, 1907);
    			attr_dev(h21, "class", "svelte-1xow2l5");
    			add_location(h21, file$1, 89, 8, 1935);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h20, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h21, anchor);
    			append_dev(h21, t2);
    			append_dev(h21, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*frame*/ 1 && t3_value !== (t3_value = /*frame*/ ctx[0].score + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h20);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h21);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(88:6) {#if frame.gameOver}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let section0;
    	let t0_value = /*frame*/ ctx[0].score + "";
    	let t0;
    	let t1;
    	let bird;
    	let t2;
    	let pipe0;
    	let t3;
    	let pipe1;
    	let t4;
    	let t5;
    	let section1;
    	let current;
    	let mounted;
    	let dispose;

    	bird = new Bird({
    			props: { bird: /*frame*/ ctx[0].bird },
    			$$inline: true
    		});

    	pipe0 = new Pipe({
    			props: { pipe: /*frame*/ ctx[0].firstPipe },
    			$$inline: true
    		});

    	pipe1 = new Pipe({
    			props: { pipe: /*frame*/ ctx[0].secondPipe },
    			$$inline: true
    		});

    	let if_block = (/*frame*/ ctx[0].gameOver || !/*frame*/ ctx[0].gameStarted) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			section0 = element("section");
    			t0 = text(t0_value);
    			t1 = space();
    			create_component(bird.$$.fragment);
    			t2 = space();
    			create_component(pipe0.$$.fragment);
    			t3 = space();
    			create_component(pipe1.$$.fragment);
    			t4 = space();
    			if (if_block) if_block.c();
    			t5 = space();
    			section1 = element("section");
    			attr_dev(section0, "id", "score");
    			attr_dev(section0, "class", "svelte-1xow2l5");
    			add_location(section0, file$1, 81, 2, 1639);
    			set_style(section1, "height", /*frame*/ ctx[0].ground.height + "px");
    			attr_dev(section1, "id", "ground");
    			attr_dev(section1, "class", "svelte-1xow2l5");
    			add_location(section1, file$1, 94, 2, 2064);
    			set_style(main, "width", /*frame*/ ctx[0].width + "px");
    			set_style(main, "height", /*frame*/ ctx[0].height + "px");
    			attr_dev(main, "class", "game svelte-1xow2l5");
    			add_location(main, file$1, 80, 0, 1558);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, section0);
    			append_dev(section0, t0);
    			append_dev(main, t1);
    			mount_component(bird, main, null);
    			append_dev(main, t2);
    			mount_component(pipe0, main, null);
    			append_dev(main, t3);
    			mount_component(pipe1, main, null);
    			append_dev(main, t4);
    			if (if_block) if_block.m(main, null);
    			append_dev(main, t5);
    			append_dev(main, section1);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "click", /*jump*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*frame*/ 1) && t0_value !== (t0_value = /*frame*/ ctx[0].score + "")) set_data_dev(t0, t0_value);
    			const bird_changes = {};
    			if (dirty & /*frame*/ 1) bird_changes.bird = /*frame*/ ctx[0].bird;
    			bird.$set(bird_changes);
    			const pipe0_changes = {};
    			if (dirty & /*frame*/ 1) pipe0_changes.pipe = /*frame*/ ctx[0].firstPipe;
    			pipe0.$set(pipe0_changes);
    			const pipe1_changes = {};
    			if (dirty & /*frame*/ 1) pipe1_changes.pipe = /*frame*/ ctx[0].secondPipe;
    			pipe1.$set(pipe1_changes);

    			if (/*frame*/ ctx[0].gameOver || !/*frame*/ ctx[0].gameStarted) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(main, t5);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (!current || dirty & /*frame*/ 1) {
    				set_style(section1, "height", /*frame*/ ctx[0].ground.height + "px");
    			}

    			if (!current || dirty & /*frame*/ 1) {
    				set_style(main, "width", /*frame*/ ctx[0].width + "px");
    			}

    			if (!current || dirty & /*frame*/ 1) {
    				set_style(main, "height", /*frame*/ ctx[0].height + "px");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bird.$$.fragment, local);
    			transition_in(pipe0.$$.fragment, local);
    			transition_in(pipe1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bird.$$.fragment, local);
    			transition_out(pipe0.$$.fragment, local);
    			transition_out(pipe1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(bird);
    			destroy_component(pipe0);
    			destroy_component(pipe1);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Game', slots, []);
    	const game = new GameController();
    	let frame = game.newGame();

    	function jump() {
    		game.jump();
    	}

    	function startGame() {
    		$$invalidate(0, frame = game.start());
    	}

    	setInterval(
    		() => {
    			$$invalidate(0, frame = game.nextFrame());
    		},
    		1000 / 90
    	);

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Bird,
    		GameController,
    		Pipe,
    		game,
    		frame,
    		jump,
    		startGame
    	});

    	$$self.$inject_state = $$props => {
    		if ('frame' in $$props) $$invalidate(0, frame = $$props.frame);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [frame, jump, startGame];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.44.0 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let game;
    	let current;
    	game = new Game({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(game.$$.fragment);
    			attr_dev(div, "class", "container svelte-4alkkh");
    			add_location(div, file, 12, 0, 192);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(game, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(game);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Game });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
