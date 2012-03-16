/**
 * Flotr Adapter
 */
(function () { 

var
  V = envision,
  A = envision.adapters,
  E = Flotr.EventAdapter,
  DEFAULTS = A.flotr.defaultOptions;

function Child (options) {
  this.options = options || {};
  this.flotr = null;
  this._flotrDefaultOptions();
}

Child.prototype = {

  destroy : function () {
    this.flotr.destroy();
  },

  draw : function (data, flotr, node) {

    var
      o           = this.options,
      fData       = [];

    data = data || o.data;

    if (flotr) {
      flotr = Flotr.clone(flotr);
      flotr = Flotr.merge(o.flotr, flotr);
    } else {
      flotr = o.flotr;
    }

    o.data = data;
    min = flotr.xaxis.min;
    max = flotr.xaxis.max;

    data = this._getDataArray(data);
    if (o.skipPreprocess) {
      flotrData = data;
    } else {
      _.each(data, function (d, index) {
        // TODO flotr
        /*
        if (!_.isArray(d) && !_.isFunction(d)) {
          fData[index] = _.clone(d);
          fData[index] = this._processData(d.data);
        } else {
        */
          fData[index] = this._processData(d, flotr);
        //}
      }, this);

      fData = fData[0];
      var
        flotrData = [],
        x = fData[0],
        y = fData[1],
        i;
      for (i = 0; i < x.length; i++) {
        flotrData.push([x[i], y[i]]);
      }
      flotrData = [flotrData];
    }

    if (!flotr) throw 'No graph submitted.';

    this.flotr = Flotr.draw(node, flotrData, flotr);
  },

  _processData : function (data, flotr) {

    var
      options     = this.options,
      process     = options.processData,
      resolution  = options.width,
      axis        = flotr.xaxis,
      min         = axis.min,
      max         = axis.max,
      preprocessor;

    if (_.isFunction(data)) {
      return data(min, max, resolution);
    } else if (process) {
      preprocessor = new V.Preprocessor({data : data});
      process.apply(this, [{
        preprocessor : preprocessor,
        min : min,
        max : max,
        resolution : resolution
      }]);
    } else {
      preprocessor = new V.Preprocessor({data : data})
        .bound(min, max)
        .subsampleMinMax(resolution);
    }

    return preprocessor.getData();
  },

  _getDataArray : function (data) {

    if (data[0] && (!_.isArray(data[0]) || (data[0][0] && _.isArray(data[0][0]))))
      return data;
    else
      return [data];
  },

  _flotrDefaultOptions : function (options) {

    var o = options || this.options.flotr,
      i;

    for (i in DEFAULTS) {
      if (DEFAULTS.hasOwnProperty(i)) {
        if (_.isUndefined(o[i])) {
          o[i] = DEFAULTS[i];
        } else {
          _.defaults(o[i], DEFAULTS[i]);
        }
      }
    }
  },

  attach : function (component, name, callback) {

    var
      event = this.events[name] || {},
      name = event.name || false,
      handler = event.handler || false;

    if (handler) {

      return E.observe(component.node, name, function () {

        var
          args = [component].concat(Array.prototype.slice.call(arguments)),
          result = handler.apply(this, args);

        return callback.apply(null, [component, result]);

      });
    } else {
      return false;
    }
  },

  detach : function (component, name, callback) {
    return E.stopObserve(component.node, name, handler);
  },

  trigger : function (component, name, options) {

    var
      event = this.events[name],
      consumer = event.consumer || false;

    return consumer ? consumer.apply(this, [component, options]) : false;
  },

  events : {

    hit : {
      name : 'flotr:hit',
      handler : function (component, hit) {

        var
          x = hit.x,
          y = hit.y,
          graph = component.api.flotr,
          options;

        // Normalized hit:
        options = {
          data : {
            index : hit.index,
            x : x,
            y : y
          },
          x : graph.axes.x.d2p(x),
          y : graph.axes.y.d2p(y)
        };

        return options;
      },
      consumer : function (component, hit) {

        var
          graph = component.api.flotr,
          o;

        // TODO this is a hack;
        // the hit plugin should expose an API to do this easily
        o = {
          x : hit.data.x,
          y : hit.data.y || 1,
          relX : hit.x,
          relY : hit.y || 1
        };

        graph.hit.hit(o);
      }
    },

    select : {
      name : 'flotr:selecting',
      handler : function (component, selection) {

        var
          mode = component.options.flotr.selection.mode,
          axes = component.api.flotr.axes,
          datax, datay, x, y, options;

        if (mode.indexOf('x') !== -1) {
          datax = {};
          datax.min = selection.x1;
          datax.max = selection.x2;
          x = {};
          x.min = axes.x.d2p(selection.x1);
          x.max = axes.x.d2p(selection.x2);
        }

        if (mode.indexOf('y') !== -1) {
          datay = {};
          datay.min = selection.y1;
          datay.max = selection.y2;
          y = {};
          y.min = axes.y.d2p(selection.y1);
          y.max = axes.y.d2p(selection.y2);
        }

        // Normalized selection:
        options = {
          data : {
            x : datax,
            y : datay
          },
          x : x,
          y : y
        }

        return options;
      },
      consumer : function (component, selection) {

        var
          graph = component.api.flotr,
          axes = graph.axes,
          data = selection.data || {},
          options = {},
          x = selection.x,
          y = selection.y;

        if (!x && data.x) {
          // Translate data to pixels
          x = data.x;
          options.x1 = axes.x.d2p(x.min);
          options.x2 = axes.x.d2p(x.max);
        } else if (x) {
          // Use pixels
          options.x1 = x.min;
          options.x2 = x.max;
        }

        if (!y && data.y) {
          // Translate data to pixels
          y = data.y;
          options.y1 = axes.y.d2p(y.min);
          options.y2 = axes.y.d2p(y.max);
        } else if (y) {
          // Use pixels
          options.y1 = y.min;
          options.y2 = y.max;
        }

        graph.selection.setSelection(options);
      }
    },

    zoom : {
      consumer : function (component, selection) {

        var
          x = selection.data.x,
          y = selection.data.y,
          options = {};

        if (x) {
          options.xaxis = {
            min : x.min,
            max : x.max
          };
        }

        if (y) {
          options.yaxis = {
            min : y.min,
            max : y.max
          };
        }

        component.draw(null, options);
      }
    },

    mouseout : {
      name : 'flotr:mouseout',
      handler : function (component) {
      },
      consumer : function (component) {
        component.api.flotr.hit.clearHit();
      }
    },

    click : {
      name : 'flotr:click',
      handler : function (component) {

        var
          min = component.api.flotr.axes.x.min,
          max = component.api.flotr.axes.x.max;

        return {
          data : {
            x : {
              min : min,
              max : max
            }
          },
          x : {
            min : component.api.flotr.axes.x.d2p(min),
            max : component.api.flotr.axes.x.d2p(max)
          }
        };
      },
      consumer : function (component, selection) {

        var
          x = selection.data.x,
          y = selection.data.y,
          options = {};

        if (x) {
          options.xaxis = {
            min : x.min,
            max : x.max
          };
        }

        if (y) {
          options.yaxis = {
            min : y.min,
            max : y.max
          };
        }

        component.draw(null, options);
      }
    }
  }
};

A.flotr.Child = Child;

})();
