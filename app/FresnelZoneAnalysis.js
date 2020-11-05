/**
 *
 * FresnelZoneAnalysis
 *  - Fresnel Zone Analysis
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  8/12/2020 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/core/Collection",
  "dojo/dom-construct",
  "esri/WebScene",
  "esri/layers/Layer",
  "esri/layers/FeatureLayer",
  "esri/views/SceneView",
  "./FresnelZoneSource"
], function(Accessor, watchUtils, promiseUtils, Collection,
            domConstruct, WebScene, Layer,
            FeatureLayer, SceneView, FresnelZoneSource){

  const FresnelZoneSourceCollection = Collection.ofType(FresnelZoneSource);

  const FresnelZoneAnalysis = Accessor.createSubclass({
    declaredClass: "FresnelZoneAnalysis",

    _viewSync: null,

    properties: {
      container: {
        type: HTMLDivElement
      },
      view: {
        type: SceneView,
        set: function(value){
          this._set('view', value);
          this.initializeSources();
          this.initializeConnections();
          this._viewSync = this.initializeSyncedViews([this.view])
        }
      },
      fresnelZonesSourcesLayer: {
        type: FeatureLayer
      },
      fresnelZoneSources: {
        type: FresnelZoneSourceCollection
      },
      add: {
        aliasOf: 'zones.add'
      }
    },

    /**
     *
     */
    constructor: function(){
      this.fresnelZoneSources = new FresnelZoneSourceCollection();
    },

    _getNextSourceID: function(){
      return (this.fresnelZoneSources.length + 1);
    },

    /**
     *
     */
    initializeSources: function(){

      //const themeTextColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-text-color').trim();
      const themeBackgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-background-color').trim();
      const themeHighlightColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-highlight-color').trim();

      const sourceLocationColor = themeBackgroundColor || '#fcfcfc';
      const sourceLocationFillColor = themeHighlightColor || '#1f79be';

      const getSourceSymbol = color => {
        return {
          type: "point-3d",
          symbolLayers: [{
            type: "object",
            width: 10,
            depth: 10,
            height: 50,
            resource: { primitive: "inverted-cone" },
            material: { color: color }
          }]
        }
      };

      this.fresnelZonesSourcesLayer = new FeatureLayer({
        fields: [
          {
            name: "ObjectID",
            alias: "ObjectID",
            type: "oid"
          },
          {
            name: "id",
            alias: "ID",
            type: "integer"
          },
          {
            name: "status",
            alias: "Status",
            type: "string"
          },
          {
            name: "count",
            alias: "Count",
            type: "integer"
          }
        ],
        objectIdField: "ObjectID",
        geometryType: "point",
        hasZ: true,
        spatialReference: { wkid: 3857 },
        source: [],
        renderer: {
          type: "simple",
          symbol: getSourceSymbol(sourceLocationFillColor)
        },
        labelingInfo: [
          {
            labelExpressionInfo: {
              //expression: "Concatenate([$feature.id, $feature.count], ' : ')"
              expression: "$feature.id"
            },
            symbol: {
              type: "label-3d",
              symbolLayers: [
                {
                  type: "text",
                  size: 19,
                  material: { color: sourceLocationFillColor },
                  halo: { color: sourceLocationColor, size: 1.5 }
                }
              ]
            }
          }
        ]
      });
      this.fresnelZonesSourcesLayer.on('layerview-create', (evt) => {
        evt.layerView.visible = (evt.view === this.view);
      });
      this.view.map.add(this.fresnelZonesSourcesLayer);


      this.addFresnelZonesSourceGraphic = (newFresnelZoneSource) => {
        const newObserverGraphic = {
          geometry: newFresnelZoneSource.observer,
          attributes: { 'id': newFresnelZoneSource.id, 'count': 0, 'status': 'unknown' }
        };
        this.fresnelZonesSourcesLayer.applyEdits({ addFeatures: [newObserverGraphic] });
      }

    },

    /**
     *
     */
    initializeConnections: function(){

      const getConnectionSymbol = color => {
        return {
          type: "line-3d",
          symbolLayers: [{
            type: "path",
            profile: "circle",
            profileRotation: "heading",
            cap: "round",
            join: "round",
            material: { color: color },
            size: 20
          }]
        }
      };

      this.connections = new FeatureLayer({
        fields: [
          {
            name: "ObjectID",
            alias: "ObjectID",
            type: "oid"
          },
          {
            name: "status",
            alias: "Status",
            type: "string"
          },
          {
            name: "count",
            alias: "Count",
            type: "integer"
          }
        ],
        objectIdField: "ObjectID",
        geometryType: "polyline",
        hasZ: true,
        spatialReference: { wkid: 3857 },
        source: [],
        renderer: {
          type: "unique-value",
          field: "status",
          defaultSymbol: getConnectionSymbol('dodgerblue'),
          uniqueValueInfos: [
            {
              value: 'connected',
              symbol: getConnectionSymbol('lime')
            },
            {
              value: 'not-connected',
              symbol: getConnectionSymbol('red')
            }
          ]
        }
      });
      this.connections.on('layerview-create', (evt) => {
        evt.layerView.visible = (evt.view === this.view);
      });
      this.view.map.add(this.connections);

    },

    /**
     *
     * @param location
     */
    addSource: function(location){
      return promiseUtils.create((resolve, reject) => {

        const newSourceLocation = location.clone();
        newSourceLocation.z += 3.0;

        // SCENE VIEW //
        const fresnelZoneSourceView = new SceneView({
          container: domConstruct.create('div', { className: 'analysis-view-container panel panel-white' }, this.container),
          //map: this.view.map,
          map: new WebScene({ portalItem: { id: this.view.map.portalItem.id } }),
          viewpoint: this.view.viewpoint,
          ui: { components: [] }
        });
        fresnelZoneSourceView.when(() => {
          watchUtils.whenFalseOnce(fresnelZoneSourceView, 'updating', () => {

            // FRESNEL ZONE SOURCE //
            const newFresnelZoneSource = new FresnelZoneSource({
              id: this._getNextSourceID(),
              view: fresnelZoneSourceView,
              observer: newSourceLocation.clone()
            });

            // ADD FROM/TO TARGETS //
            this.fresnelZoneSources.forEach(fresnelZoneSource => {
              newFresnelZoneSource.addTarget(fresnelZoneSource);
              fresnelZoneSource.addTarget(newFresnelZoneSource);
            });

            // ADD TO COLLECTION OF TARGETS //
            this.fresnelZoneSources.add(newFresnelZoneSource);

            // ADD SOURCE GRAPHIC //
            this.addFresnelZonesSourceGraphic(newFresnelZoneSource);

            // SYNC VIEWS //
            this._viewSync.add(fresnelZoneSourceView);

            resolve();
          });
        });

      });
    },

    /*updateAnalysis: function(){
      this.fresnelZoneSources.forEach(fresnelZoneSource => {
        fresnelZoneSource.updateAnalysis();
      });
    }*/

    /**
     *
     * @param mapViews
     * @returns {{add: add}}
     */
    initializeSyncedViews: function(mapViews){

      const synchronizeView = (view, others) => {
        others = Array.isArray(others) ? others : [others];

        let viewpointWatchHandle;
        let viewStationaryHandle;
        let otherInteractHandlers;
        let scheduleId;

        const clear = () => {
          if(otherInteractHandlers){
            otherInteractHandlers.forEach((handle) => {
              handle.remove();
            });
          }
          viewpointWatchHandle && viewpointWatchHandle.remove();
          viewStationaryHandle && viewStationaryHandle.remove();
          scheduleId && clearTimeout(scheduleId);
          otherInteractHandlers = viewpointWatchHandle = viewStationaryHandle = scheduleId = null;
        };

        const interactWatcher = view.watch('interacting,animation', (newValue) => {
          if(!newValue){ return; }
          if(viewpointWatchHandle || scheduleId){ return; }

          if(!view.animation){
            others.forEach((otherView) => {
              otherView.viewpoint = view.viewpoint.clone();
            });
          }

          // start updating the other views at the next frame
          scheduleId = setTimeout(() => {
            scheduleId = null;
            viewpointWatchHandle = view.watch('viewpoint', (viewpoint) => {
              others.forEach((otherView) => {
                otherView.viewpoint = viewpoint.clone();
              });
            });
          }, 0);

          // stop as soon as another view starts interacting, like if the user starts panning
          otherInteractHandlers = others.map((otherView) => {
            return watchUtils.watch(otherView, 'interacting,animation', (value) => {
              if(value){ clear(); }
            });
          });

          // or stop when the view is stationary again
          viewStationaryHandle = watchUtils.whenTrue(view, 'stationary', clear);
        });

        return {
          remove: () => {
            this.remove = () => { };
            clear();
            interactWatcher.remove();
          }
        }
      };

      const synchronizeViews = (views) => {

        let handles = views.map((view, idx, views) => {
          const others = views.concat();
          others.splice(idx, 1);
          return synchronizeView(view, others);
        });

        return {
          remove: () => {
            this.remove = () => { };
            handles.forEach((h) => { h.remove(); });
            handles = null;
          }
        }
      };

      const views = [...mapViews];
      let sync_views_handle = synchronizeViews(views);

      return {
        add: (view) => {
          sync_views_handle && sync_views_handle.remove();
          views.push(view);
          sync_views_handle = synchronizeViews(views);
        }
      };

    }

  });
  FresnelZoneAnalysis.version = "0.0.1";

  return FresnelZoneAnalysis;
});
