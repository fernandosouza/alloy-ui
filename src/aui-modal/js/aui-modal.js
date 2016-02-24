/**
 * The Modal Component
 *
 * @module aui-modal
 */

var Lang = A.Lang,
    UA = A.UA,

    StdMod = A.WidgetStdMod,

    getClassName = A.getClassName,

    CSS_MODAL_BD = getClassName('modal-body'),
    CSS_MODAL_FT = getClassName('modal-footer'),
    CSS_MODAL_HD = getClassName('modal-header'),
    CSS_MODAL_OPEN = getClassName('modal-open');

/**
 * A base class for Modal.
 *
 * Check the [live demo](http://alloyui.com/examples/modal/).
 *
 * @class A.Modal
 * @extends Widget
 * @uses A.WidgetPosition, A.WidgetStdMod, A.WidgetAutohide, A.WidgetToolbars,
 *     A.WidgetModality, A.WidgetPositionAlign, A.WidgetPositionConstrain,
 *     A.WidgetStack
 * @param {Object} config Object literal specifying widget configuration
 *     properties.
 * @constructor
 * @include http://alloyui.com/examples/modal/basic-markup.html
 * @include http://alloyui.com/examples/modal/basic.js
 */
A.Modal = A.Base.create('modal', A.Widget, [
    A.WidgetCssClass,
    A.WidgetPosition,
    A.WidgetStdMod,
    A.WidgetToggle,
    A.WidgetAutohide,
    A.WidgetToolbars,
    A.WidgetPositionAlign,
    A.WidgetPositionConstrain,
    A.WidgetStack,

    // WidgetModality needs to be added after all WidgetPosition augmentations
    // to prevent it from focusing the modal before it's properly positioned,
    // which would cause the viewport to scroll to the top.
    A.WidgetModality
], {
    CONTENT_TEMPLATE: '<div class="modal-content"></div>',

    /**
     * Construction logic executed during Modal instantiation. Lifecycle.
     *
     * @method initializer
     * @protected
     */
    initializer: function() {
        var instance = this,
            eventHandles;

        eventHandles = [
            A.after(instance._afterFillHeight, instance, 'fillHeight'),
            A.after('windowresize', A.bind('_afterWindowResize', instance)),
            instance.after('render', instance._afterRender),
            instance.after('draggableChange', instance._afterDraggableChange),
            instance.after('visibleChange', instance._afterVisibleChange),
            instance.after('topFixedChange', instance._afterTopFixedChange),
            instance.after(instance._afterUiSetStdMod, instance, '_uiSetStdMod'),
            instance.on('xyChange', instance._onModalXYChange)
        ];

        instance._applyPlugin(instance._plugDrag);

        instance._eventHandles = eventHandles;
    },

    /**
     * Destructor lifecycle implementation for the `Modal` class.
     *
     * @method destructor
     * @protected
     */
    destructor: function() {
        var instance = this;

        (new A.EventHandle(instance._eventHandles)).detach();

        if (instance._userInteractionHandle) {
            instance._userInteractionHandle.detach();
        }

        A.all('body,html').removeClass(CSS_MODAL_OPEN);
    },

    /**
     * Add `bubbleTargets` to config object.
     *
     * @method _addBubbleTargets
     * @param config
     * @protected
     */
    _addBubbleTargets: function(config) {
        var instance = this;

        if (!Lang.isObject(config)) {
            config = {};
        }
        return A.mix(config, {
            bubbleTargets: instance
        });
    },

    /**
     * Fire after drag changes.
     *
     * @method _afterDraggableChange
     * @param event
     * @protected
     */
    _afterDraggableChange: function(event) {
        var instance = this;

        if (event.newVal) {
            instance._applyPlugin(instance._plugDrag);
        }
        else {
            instance.unplug(A.Plugin.Drag);
        }
    },

    /**
     * Fire after `maxHeight` CSS property changes.
     *
     * @method _afterFillHeight
     * @param event
     * @protected
     */
    _afterFillHeight: function() {
        var instance = this;

        instance._fillMaxHeight(instance.get('height'));
    },

    /**
     * Fire after modal is rendered.
     *
     * @method _afterRender
     * @protected
     */
    _afterRender: function() {
        if (this.get('dynamicContentHeight')) {
            this._configModalDynamicHeight();
            this.syncHeight();
        }

        if (this.get('visible')) {
            A.all('body,html').addClass(CSS_MODAL_OPEN);
        }
    },

    /**
     * Fire after visibility changes.
     *
     * @method _afterVisibleChange
     * @param event
     * @protected
     */
    _afterVisibleChange: function(event) {
        var instance = this;

        if (!event.newVal && instance.get('destroyOnHide')) {
            A.soon(A.bind('destroy', instance));
        }

        A.all('body,html').toggleClass(CSS_MODAL_OPEN, event.newVal);
    },

    /**
     * Fire after topFixed changes.
     *
     * @method _afterTopFixedChange
     * @protected
     */
    _afterTopFixedChange: function() {
        this.align();
    },

    /**
     * Fires after the 'windowresize' event.
     *
     * @method _afterWindowResize
     * @param event
     */
    _afterWindowResize: function() {
        var instance = this;

        if (this.get('dynamicContentHeight')) {
            instance.syncHeight();
        }

        if (instance.get('centered')) {
            instance.align();
        }
    },

    /**
     * Applies a plugin to the modal instance.
     *
     * @method _applyPlugin
     * @param pluginFn
     * @protected
     */
    _applyPlugin: function(pluginFn) {
        var instance = this;

        if (UA.touchEnabled) {
            pluginFn.call(instance);
        }
        else if (!instance._userInteractionHandle) {
            instance._userInteractionHandle = instance.once(
                ['click', 'mousemove'], instance._onUserInitInteraction, instance);
        }
    },

    /**
     * Settup Modal Dynamic Content.
     *
     * @method _configModalDynamicHeight
     * @protected
     */
    _configModalDynamicHeight: function() {
        this.get('boundingBox').addClass('dynamic-content-height');
    },

    /**
     * Set `maxHeight` CSS property.
     *
     * @method _fillMaxHeight
     * @param height
     * @protected
     */
    _fillMaxHeight: function(height) {
        var instance = this,
            fillHeight = instance.get('fillHeight'),
            node = instance.getStdModNode(fillHeight, true);

        if (node) {
            node.setStyle('maxHeight', height);
        }
    },

    /**
     * Assign the Y coordinate of modal as 0.
     *
     * @method _fixAtTheTop
     * @param xy
     * @protected
     */
    _fixAtTheTop: function(xy) {
        xy[1] = A.config.win.scrollY + parseInt(this.get('boundingBox').getComputedStyle('margin-top'));

        return xy;
    },

    /**
     * Get the difference between Modal Body Height and Modal Bounding Box Height
     *
     * @method _getModalOffset
     * @protected
     */
    _getModalOffset: function() {
        var boundingBox = this.get('boundingBox'),
            boundingOuterHeight,
            modalBodyHeight = A.one('.' + CSS_MODAL_BD).get('offsetHeight');

            boundingOuterHeight = boundingBox.get('offsetHeight') + 
                parseInt(boundingBox.getComputedStyle('marginTop')) + 
                parseInt(boundingBox.getComputedStyle('marginBottom'));

        return Math.max(modalBodyHeight, boundingOuterHeight) - Math.min(modalBodyHeight, boundingOuterHeight);
    },

    /**
     * Create node using predefined templates.
     *
     * @method _getStdModTemplate
     * @param section
     * @protected
     */
    _getStdModTemplate: function(section) {
        return A.Node.create(A.Modal.TEMPLATES[section], this._stdModNode.get('ownerDocument'));
    },

    /**
     * Fired after the `xy` coordinates of modal is changed.
     *
     * @method _getStdModTemplate
     * @param event
     * @protected
     */
    _onModalXYChange: function(event) {
        if (this.get('topFixed') && this.get('centered')) {
            event.newVal = this._fixAtTheTop(event.newVal);
        }
    },

    /**
     * Plug draggable and detach user interaction handle.
     *
     * @method _onUserInitInteraction
     * @protected
     */
    _onUserInitInteraction: function() {
        var instance = this;

        instance._plugDrag();

        instance._userInteractionHandle.detach();
        instance._userInteractionHandle = null;
    },

    /**
     * Plug the drag Plugin
     *
     * @method _plugDrag
     * @protected
     */
    _plugDrag: function() {
        var instance = this,
            draggable = instance.get('draggable');

        if (draggable) {
            instance.plug(A.Plugin.Drag, instance._addBubbleTargets(draggable));
        }
    },

    /**
     * Syncronize Modal Body according to its content.
     *
     * @method syncHeight
     * @protected
     */
    syncHeight: function() {
        var modalBody = A.one('.' + CSS_MODAL_BD),
            property = 'max-height';

        A.one('body').removeClass('sm-screen');

        modalBody.setStyle('min-height', 'auto');
        modalBody.setStyle('max-height', '100%');

        if (A.DOM.winWidth(document) < 768) {
            property = 'min-height';

            A.one('body').addClass('sm-screen');
        }

        modalBody.setStyle(property, A.DOM.winHeight(document) - this._getModalOffset());
    }
}, {

    /**
     * Static property provides a string to identify the CSS prefix.
     *
     * @property CSS_PREFIX
     * @type String
     * @static
     */
    CSS_PREFIX: getClassName('modal-dialog'),

    /**
     * Static property used to define the default attribute
     * configuration for the Modal.
     *
     * @property ATTRS
     * @type Object
     * @static
     */
    ATTRS: {

        /**
         * Determine the content of Modal's body section.
         *
         * Temporary fix for widget-stdmod bug when bodyContent initializes
         * empty. this._currFillNode is never updated if _uiSetFillHeight is not
         * called.
         *
         * @attribute bodyContent
         * @default ''
         * @type String
         */
        bodyContent: {
            value: ''
        },

        /**
         * Determine if Modal should be destroyed when hidden.
         *
         * @attribute destroyOnHide
         * @default false
         * @type Boolean
         */
        destroyOnHide: {
            validator: Lang.isBoolean,
            value: false
        },

        /**
         * Determine if Modal should be draggable or not.
         *
         * @attribute draggable
         * @type Object
         * @writeOnce
         */
        draggable: {
            value: {
                handles: ['.' + CSS_MODAL_HD],
                plugins: [
                    {
                        fn: A.Plugin.DDConstrained
                    }
                ]
            }
        },

        /**
         * Determine if Modal will have its content height dynamically updated.
         *
         * @attribute dynamicContentHeight
         * @default false
         * @type Boolean
         */
        dynamicContentHeight: {
            value: false,
            writeOnce: true
        },

        /**
         * Determine the content of Modal's header section.
         *
         * @attribute toolbars
         * @type Function
         */
        toolbars: {
            valueFn: function() {
                var instance = this;

                return {
                    header: [
                        {
                            cssClass: 'close',
                            discardDefaultButtonCssClasses: true,
                            labelHTML: '<span> \u00D7 </span>',
                            on: {
                                click: function(event) {
                                    instance.hide();

                                    event.domEvent.stopPropagation();
                                }
                            },
                            render: true
                        }
                    ]
                };
            }
        },

        /**
         * Determine the css classes of Modal's sections.
         *
         * @attribute toolbarCssClass
         * @type Object
         */
        toolbarCssClass: {
            value: {
                header: 'pull-right'
            }
        },

        /**
         * Works with centered attribute. Keeps the modal fixed at the top of the
         * window taking into consideration his margin top.
         *
         * @attribute topFixed
         * @default false
         * @type Boolean
         */
        topFixed: {
            value: false,
            validator: function() {
                return (this.get('centered'));
            }
        },
    },

    /**
     * Static property provides a set of reusable templates.
     *
     * @property TEMPLATES
     * @type Object
     * @static
     */
    TEMPLATES: {
        header: '<div class="' + StdMod.SECTION_CLASS_NAMES[StdMod.HEADER] + ' ' + CSS_MODAL_HD + '"></div>',
        body: '<div class="' + StdMod.SECTION_CLASS_NAMES[StdMod.BODY] + ' ' + CSS_MODAL_BD + '"></div>',
        footer: '<div class="' + StdMod.SECTION_CLASS_NAMES[StdMod.FOOTER] + ' ' + CSS_MODAL_FT + '"></div>'
    }
});
