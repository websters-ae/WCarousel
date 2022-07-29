(function (factory) {
    typeof define === 'function' && define.amd
        ? define(factory)
        : typeof exports === 'object'
            ? (module.exports = factory())
            : factory()
})(function () {
    ('use strict')

    const _window = typeof window !== 'undefined' ? window : this

    const WCarousel = (_window.WCarousel = function (element, settings) {
        if (element.wc) return element.wc
        let self = this

        self.ele = element
        self.ele.classList.add('wc-control')

        // expose wc object to its DOM element
        self.ele.wc = this

        // merge user setting with defaults
        self.opt = Object.assign(
            {},
            {
                slidesToScroll: 1,
                slidesToShow: 1,
                resizeLock: true,
                duration: 0.5,
                // easeInQuad
                easing: function (x, t, b, c, d) {
                    return c * (t /= d) * t + b
                }
            },
            settings
        )

        // defaults
        self.animate_id = 0
        self.page = 0
        self.slide = 0
        self.arrows = {}

        self._opt = self.opt

        // items wrapper
        self.track = document.createElement('div')
        self.ele.appendChild(self.track)
        while (self.ele.children.length !== 1) {
            self.track.appendChild(self.ele.children[0])
        }

        self.track.classList.add('wc-track')
        self.init()

        self.resize = self.init.bind(self, true)
        self.event(self.ele, 'add', {
            scroll: self.updateControls.bind(self)
        })
        self.event(_window, 'add', {
            resize: self.resize
        })
    })

    const wcPrototype = WCarousel.prototype

    wcPrototype.init = function (refresh, paging) {
        let self = this
        self.slides = self.track.children;

        self.forEachTwo(self.slides, (element, index) => {
            element.classList.add('wc-slide')
            element.setAttribute('data-wcslide', ++index)
        })

        self.containerWidth = self.ele.clientWidth

        let breakpointChanged = self.settingsBreakpoint()
        if (!paging) paging = breakpointChanged

        if (self.opt.slidesToShow === 'auto' || typeof self.opt.autoSlide !== 'undefined') {
            const slideCount = self.containerWidth / self.opt.itemWidth

            self.opt.autoSlide = self.opt.slidesToShow = self.opt.exactWidth
                ? slideCount
                : Math.max(1, Math.floor(slideCount))
        }

        if (self.opt.slidesToScroll === 'auto') {
            self.opt.slidesToScroll = Math.floor(self.opt.slidesToShow)
        }

        self.itemWidth = self.opt.exactWidth
            ? self.opt.itemWidth
            : self.containerWidth / self.opt.slidesToShow;

        let width = 0, height = 0;

        self.forEachTwo(self.slides, (e) => {
            e.style.height = 'auto'
            e.style.width = self.itemWidth + 'px'
            width += self.itemWidth
            height = Math.max(e.offsetHeight, height)
        })

        self.track.style.width = width + 'px'
        self.trackWidth = width
        self.isDrag = false
        self.preventClick = false
        self.move = false

        self.opt.resizeLock && self.scrollTo(self.slide * self.itemWidth, 0)

        if (breakpointChanged || paging) {
            self.bindArrows()
            self.buildDots()
            self.bindDrag()
        }

        self.updateControls()

        self.emit(refresh ? 'refresh' : 'loaded')
    }

    wcPrototype.bindArrows = function () {
        let self = this
        if (!self.opt.arrows) {
            Object.keys(self.arrows).forEach(function (direction) {
                const element = self.arrows[direction]
                self.event(element, 'remove', { click: element.func })
            })
            return
        }
        ['prev', 'next'].forEach(function (direction) {
            let arrow = self.opt.arrows[direction]
            if (arrow) {
                if (typeof arrow === 'string') {
                    arrow = document.querySelector(arrow)
                }
                if (arrow) {
                    arrow.func = arrow.func || self.scrollItem.bind(self, direction)
                    self.event(arrow, 'remove', {
                        click: arrow.func
                    })
                    self.event(arrow, 'add', {
                        click: arrow.func
                    })
                    self.arrows[direction] = arrow
                }
            }
        })
    }

    wcPrototype.buildDots = function () {
        let self = this

        if (!self.opt.dots) {
            if (self.dots) self.dots.innerHTML = ''
            return
        }

        if (typeof self.opt.dots === 'string') {
            self.dots = document.querySelector(self.opt.dots)
        } else self.dots = self.opt.dots
        if (!self.dots) return

        self.dots.innerHTML = ''
        self.dots.setAttribute('role', 'tablist')
        self.dots.classList.add('wc-dots')

        for (let i = 0; i < Math.ceil(self.slides.length / self.opt.slidesToShow); ++i) {
            const dot = document.createElement('button')
            dot.dataset.index = i
            dot.setAttribute('aria-label', 'Page ' + (i + 1))
            dot.setAttribute('role', 'tab')
            dot.className = 'wc-dot ' + (i ? '' : 'active')
            self.event(dot, 'add', {
                click: self.scrollItem.bind(self, i, true)
            })
            self.dots.appendChild(dot)
        }
    }

    wcPrototype.bindDrag = function () {
        let self = this
        self.mouse = self.mouse || self.handleMouse.bind(self)

        const mouseup = function () {
            self.mouseDown = undefined
            self.ele.classList.remove('drag')
            if (self.isDrag) {
                self.preventClick = true
            }
            self.isDrag = false
        }

        const move = function () {
            self.move = true
        }

        const events = {
            mouseup: mouseup,
            mouseleave: mouseup,
            mousedown: function (e) {
                e.preventDefault()
                e.stopPropagation()
                self.mouseDown = e.clientX
                self.ele.classList.add('drag')
                self.move = false
                setTimeout(move, 300)
            },
            touchstart: function (e) {
                self.ele.classList.add('drag')
                self.move = false
                setTimeout(move, 300)
            },
            mousemove: self.mouse,
            click: function (e) {
                if (self.preventClick && self.move) {
                    e.preventDefault()
                    e.stopPropagation()
                }
                self.preventClick = false
                self.move = false
            }
        }

        self.ele.classList.toggle('draggable', self.opt.draggable === true)
        self.event(self.ele, 'remove', events)
        if (self.opt.draggable) self.event(self.ele, 'add', events)
    }

    wcPrototype.handleMouse = function (e) {
        let self = this
        if (self.mouseDown) {
            self.isDrag = true
            self.ele.scrollLeft +=
                (self.mouseDown - e.clientX) * (self.opt.dragVelocity || 1.5)
            self.mouseDown = e.clientX
        }
    }

    wcPrototype.settingsBreakpoint = function () {
        let self = this
        const resp = self._opt.responsive

        if (resp) {
            // Sort the breakpoints in mobile first order
            resp.sort(function (a, b) {
                return b.breakpoint - a.breakpoint
            })

            for (let i = 0; i < resp.length; ++i) {
                let size = resp[i]
                if (document.body.clientWidth >= size.breakpoint) {
                    if (self.breakpoint !== size.breakpoint) {
                        self.opt = Object.assign({}, self._opt, size.settings)
                        self.breakpoint = size.breakpoint
                        return true
                    }
                    return false
                }
            }
        }
        // set back to defaults in case they were overriden
        const breakpointChanged = self.breakpoint !== 0
        self.opt = Object.assign({}, self._opt)
        self.breakpoint = 0
        return breakpointChanged
    }

    wcPrototype.scrollTo = function (scrollTarget, scrollDuration, callback) {
        let self = this
        const date = new Date()
        const start = date.getTime()
        const animateIndex = self.animate_id

        const animate = function () {
            const d = new Date()
            const now = d.getTime() - start
            self.ele.scrollLeft =
                self.ele.scrollLeft +
                (scrollTarget - self.ele.scrollLeft) *
                self.opt.easing(0, now, 0, 1, scrollDuration)
            if (now < scrollDuration && animateIndex === self.animate_id) {
                _window.requestAnimationFrame(animate)
            } else {
                self.ele.scrollLeft = scrollTarget
                callback && callback.call(self)
            }
        }

        _window.requestAnimationFrame(animate)
    }

    wcPrototype.updateControls = function (event) {
        let self = this

        if (event && !self.opt.scrollPropagate) {
            event.stopPropagation()
        }

        const disableArrows = self.containerWidth >= self.trackWidth

        if (!self.opt.rewind) {
            if (self.arrows.prev) {
                self.arrows.prev.classList.toggle(
                    'disabled',
                    self.ele.scrollLeft <= 0 || disableArrows
                )

                self.arrows.prev.setAttribute(
                    'aria-disabled',
                    self.arrows.prev.classList.contains('disabled')
                )
            }
            if (self.arrows.next) {
                self.arrows.next.classList.toggle(
                    'disabled',
                    Math.ceil(self.ele.scrollLeft + self.containerWidth) >=
                    Math.floor(self.trackWidth) || disableArrows
                )

                self.arrows.next.setAttribute(
                    'aria-disabled',
                    self.arrows.next.classList.contains('disabled')
                )
            }
        }

        self.slide = Math.round(self.ele.scrollLeft / self.itemWidth)
        self.page = Math.round(self.ele.scrollLeft / self.containerWidth)

        const middle = self.slide + Math.floor(Math.floor(self.opt.slidesToShow) / 2)

        let extraMiddle = Math.floor(self.opt.slidesToShow) % 2 ? 0 : middle + 1
        if (Math.floor(self.opt.slidesToShow) === 1) {
            extraMiddle = 0
        }

        // the last page may be less than one half of a normal page width so
        // the page is rounded down. when at the end, force the page to turn
        if (self.ele.scrollLeft + self.containerWidth >= Math.floor(self.trackWidth)) {
            self.page = self.dots ? self.dots.children.length - 1 : 0
        }

        self.forEachTwo(self.slides, (slide, index) => {
            const slideClasses = slide.classList
            const wasVisible = slideClasses.contains('visible')
            const start = self.ele.scrollLeft
            const end = self.ele.scrollLeft + self.containerWidth
            const itemStart = self.itemWidth * index
            const itemEnd = itemStart + self.itemWidth;

            self.forEachTwo(slideClasses, (className) => /^left|right/.test(className) && slideClasses.remove(className))
    
            slideClasses.toggle('active', self.slide === index)
            if (middle === index || (extraMiddle && extraMiddle === index)) {
                slideClasses.add('center')
            } else {
                slideClasses.remove('center')
                slideClasses.add(
                    [
                        index < middle ? 'left' : 'right',
                        Math.abs(index - (index < middle ? middle : extraMiddle || middle))
                    ].join('-')
                )
            }
    
            const isVisible = Math.ceil(itemStart) >= Math.floor(start)
                && Math.floor(itemEnd) <= Math.ceil(end)
    
            slideClasses.toggle('visible', isVisible)
    
            if (isVisible !== wasVisible) {
                self.emit('slide-' + (isVisible ? 'visible' : 'hidden'), {
                    slide: index
                })
            }
        })

        if (self.dots) {
            self.forEachTwo(self.dots.children, (e, i) => e.classList.toggle('active', self.page === i))
        }

        if (event && self.opt.scrollLock) {
            clearTimeout(self.scrollLock)
            self.scrollLock = setTimeout(function () {
                clearTimeout(self.scrollLock)
                // dont attempt to scroll less than a pixel fraction - causes looping
                if (Math.abs(self.ele.scrollLeft / self.itemWidth - self.slide) > 0.02) {
                    if (!self.mouseDown) {
                        // Only scroll if not at the end (#94)
                        if (self.trackWidth > self.containerWidth + self.ele.scrollLeft) {
                            self.scrollItem(self.getCurrentSlide())
                        }
                    }
                }
            }, self.opt.scrollLockDelay || 250)
        }
    }

    wcPrototype.getCurrentSlide = function () {
        return this.round(this.ele.scrollLeft / this.itemWidth)
    }

    // used to round to the nearest 0.XX fraction
    wcPrototype.round = function (double) {
        const step = this.opt.slidesToScroll % 1 || 1
        const inv = 1.0 / step
        return Math.round(double * inv) / inv
    }

    wcPrototype.refresh = function (paging) {
        this.init(true, paging)
    }

    wcPrototype.scrollItem = function (slide, dot, e) {
        if (e) {
            e.preventDefault()
        }    

        var self = this

        var originalSlide = slide
        ++self.animate_id

        var prevSlide = self.slide
        var position

        if (dot === true) {
            slide = Math.round((slide * self.containerWidth) / self.itemWidth)
            position = slide * self.itemWidth
        } else {
            if (typeof slide === 'string') {
                var backwards = slide === 'prev'

                // use precise location if fractional slides are on
                if (self.opt.slidesToScroll % 1 || self.opt.slidesToShow % 1) {
                    slide = self.getCurrentSlide()
                } else {
                    slide = self.slide
                }

                if (backwards) slide -= self.opt.slidesToScroll
                else slide += self.opt.slidesToScroll

                if (self.opt.rewind) {
                    var scrollLeft = self.ele.scrollLeft
                    slide =
                        backwards && !scrollLeft
                            ? self.slides.length
                            : !backwards &&
                                scrollLeft + self.containerWidth >= Math.floor(self.trackWidth)
                                ? 0
                                : slide
                }
            }

            slide = Math.max(Math.min(slide, self.slides.length), 0)

            self.slide = slide
            position = self.itemWidth * slide
        }

        self.emit('scroll-item', { prevSlide, slide })

        self.scrollTo(
            position,
            self.opt.duration * Math.abs(self.ele.scrollLeft - position),
            function () {
                self.updateControls()
                self.emit('animated', {
                    value: originalSlide,
                    type: typeof originalSlide === 'string' ? 'arrow' : dot ? 'dot' : 'slide'
                })
            }
        )

        return false
    }

    wcPrototype.event = function (ele, type, args) {
        const eventHandler = ele[type + 'EventListener'].bind(ele)
        Object.keys(args).forEach(function (k) {
            eventHandler(k, args[k])
        })
    }

    wcPrototype.emit = function (name, arg) {
        let self = this

        var e = new _window.CustomEvent('glider-' + name, {
            bubbles: !self.opt.eventPropagate,
            detail: arg
        })
        self.ele.dispatchEvent(e)
    }

    wcPrototype.forEachTwo = function (arr, func) {
        let isNotEven = arr.length % 2 !== 0
        let count = Math.floor(arr.length / 2)
        for (let i =0, j = count; i < count; i++, j++) {
            func(arr[i], i)
            func(arr[j], j)
        }
        if (isNotEven) {
            let index = arr.length - 1
            func(arr[index], index)
        }
    }

    return WCarousel
})
