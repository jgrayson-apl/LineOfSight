/**
 *
 * FresnelZoneResult
 *  - Fresnel Zone Result
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  8/14/2020 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "dojo/dom-construct",
  "esri/widgets/LineOfSight/LineOfSightTarget"
], function(Accessor, domConstruct, LineOfSightTarget){

  const FresnelZoneResult = Accessor.createSubclass({
    declaredClass: "FresnelZoneResult",

    properties: {
      container: {
        type: HTMLDivElement,
        set: function(value){
          this._set('container', value);
          this.resultNode = domConstruct.create('div', { className: 'analysis-result-node', innerHTML: `--` }, this.container);
        }
      },
      resultNode: {
        type: HTMLDivElement
      },
      observerId: {
        type: Number,
        set: function(value){
          this._set('observerId', value);
          this.updateLabel();
        }
      },
      targetId: {
        type: Number,
        set: function(value){
          this._set('targetId', value);
          this.updateLabel();
        }
      },
      target: {
        type: LineOfSightTarget,
        set: function(target){
          this._set('target', target);
          target.watch("visible", (visible) => {
            // this.visible = visible;
            this.resultNode.classList.toggle('visible', visible);
            //console.info(this.observerId, this.targetId, this.visible);
          });
        }
      }//,
      /*visible: {
        aliasOf: 'target.visible'
      }*/
    },

    updateLabel: function(){
      this.resultNode.innerHTML = `[${this.observerId || '--'} : ${this.targetId || '--'}]`;
    }

  });
  FresnelZoneResult.version = "0.0.1";

  return FresnelZoneResult;
});
