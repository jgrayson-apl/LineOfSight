/**
 *
 * FresnelZoneSource
 *  - A Fresnel Zone Source
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
  "dojo/dom-construct",
  "esri/views/SceneView",
  "esri/widgets/LineOfSight/LineOfSightTarget",
  "esri/widgets/LineOfSight/LineOfSightViewModel",
  "./FresnelZoneResult"
], function(Accessor, watchUtils, promiseUtils,
            domConstruct, SceneView,
            LineOfSightTarget, LineOfSight,
            FresnelZoneResult){
  /**
   *
   */
  const FresnelZoneSource = Accessor.createSubclass({
    declaredClass: "FresnelZoneSource",

    properties: {
      id: {
        type: Number
      },
      view: {
        type: SceneView,
        set: function(value){
          this._set('view', value);
          this.initializeBadge();
          this.initializeList();
          this.initializeAnalysis();
        }
      },
      visibilityListContainer: {
        type: HTMLDivElement
      },
      lineOfSight: {
        type: LineOfSight,
      },
      observer: {
        aliasOf: 'lineOfSight.observer',
        dependsOn: ['lineOfSight']
      },
      targets: {
        aliasOf: 'lineOfSight.targets',
        dependsOn: ['lineOfSight']
      },
      resultsByTargetId: {
        type: Map
      }
    },

    /**
     *
     */
    constructor: function(){
      this.resultsByTargetId = new Map();
    },

    /**
     *
     */
    initializeBadge: function(){
      const idBadge = domConstruct.create('div', {
        className: 'analysis-view-badge',
        innerHTML: this.id || '-'
      });
      this.view.ui.add(idBadge);
    },

    /**
     *
     */
    initializeList: function(){

      this.visibilityListContainer = domConstruct.create('div', {
        className: 'analysis-view-list'
      });
      this.view.ui.add(this.visibilityListContainer);

    },

    /**
     *
     */
    initializeAnalysis: function(){

      if(!this.id){ this.id = FresnelZoneSource.generateID(); }

      // LINE-OF-SIGHT //
      this.lineOfSight = new LineOfSight({ view: this.view });

      // OBSERVER //
      // this.lineOfSight.watch("observer", (observer) => {
      //   console.log("fresnelZoneSource.observer change: ", this.id, observer);
      // });

      this.lineOfSight.targets.on("before-add", () => {
        this.lineOfSight.stop();
      });
      this.lineOfSight.targets.on("after-add", () => {
        this.lineOfSight.start();
      });

    },

    /**
     *
     * @param fresnelZoneSource
     */
    addTarget: function(fresnelZoneSource){

      // TARGET //
      const newTarget = new LineOfSightTarget({ location: fresnelZoneSource.observer.clone() });

      // ANALYSIS RESULT //
      const analysisResult = new FresnelZoneResult({
        container: this.visibilityListContainer,
        observerId: this.id,
        targetId: fresnelZoneSource.id,
        target: newTarget
      });

      // ADD LOS TARGET //
      this.lineOfSight.targets.add(newTarget);

      // ADD TO RESULTS //
      this.resultsByTargetId.set(fresnelZoneSource.id, analysisResult);

    }

    /*updateAnalysis: function(){
      watchUtils.whenFalseOnce(this.view, 'updating', () => {
        // this.lineOfSight.stop();
        this.lineOfSight.start();
        this.lineOfSight.stop();
      });
    }*/

  });
  FresnelZoneSource.version = "0.0.1";

  /**
   * Modified from https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
   *    - uuidv4
   *
   * @returns {string}
   * @private
   */
  FresnelZoneSource.generateID = function(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      const r = Math.random() * 16 | 0;
      const v = (c === 'x') ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  return FresnelZoneSource;
});
