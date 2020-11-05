/*
  Copyright 2020 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

define([
  "calcite",
  "dojo/_base/declare",
  "ApplicationBase/ApplicationBase",
  "dojo/i18n!./nls/resources",
  "ApplicationBase/support/itemUtils",
  "ApplicationBase/support/domHelper",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "esri/core/Evented",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/widgets/Home",
  "esri/widgets/LineOfSight",
], function(calcite, declare, ApplicationBase,
            i18n, itemUtils, domHelper, domConstruct,
            IdentityManager, Evented, watchUtils, promiseUtils, Portal,
            Home, LineOfSight){

  return declare([Evented], {

    /**
     *
     */
    constructor: function(){
      // BASE //
      this.base = null;
      // CALCITE WEB //
      calcite.init();
    },

    /**
     *
     * @param base
     */
    init: function(base){
      if(!base){
        console.error("ApplicationBase is not defined");
        return;
      }
      this.base = base;

      const webMapItems = this.base.results.webMapItems;
      const webSceneItems = this.base.results.webSceneItems;
      const validItems = webMapItems.concat(webSceneItems);
      const firstItem = (validItems && validItems.length) ? validItems[0].value : null;
      if(!firstItem){
        console.error("Could not load an item to display");
        return;
      }

      this.base.config.title = (this.base.config.title || itemUtils.getItemTitle(firstItem));
      domHelper.setPageTitle(this.base.config.title);

      const viewProperties = itemUtils.getConfigViewProperties(this.base.config);
      viewProperties.container = "view-container";
      viewProperties.constraints = { snapToZoom: false };

      const portalItem = this.base.results.applicationItem.value;
      const appProxies = (portalItem && portalItem.appProxies) ? portalItem.appProxies : null;

      itemUtils.createMapFromItem({ item: firstItem, appProxies: appProxies }).then(map => {
        viewProperties.map = map;
        itemUtils.createView(viewProperties).then(view => {
          view.when(() => {
            this.viewReady(this.base.config, firstItem, view).then(() => {
              view.container.classList.remove("loading");
            });
          });
        });
      });
    },

    /**
     *
     * @param config
     * @param item
     * @param view
     */
    viewReady: function(config, item, view){
      return promiseUtils.create((resolve, reject) => {

        // HOME //
        const home = new Home({ view: view });
        view.ui.add(home, { position: "top-left", index: 0 });

        // APPLICATION READY //
        this.applicationReady(view).then(resolve).catch(reject);

      });

    },

    /**
     * APPLICATION READY
     *
     * @param view
     */
    applicationReady: function(view){
      return promiseUtils.create((resolve, reject) => {

        watchUtils.whenFalseOnce(view, 'updating', () => {

          const losPanel = document.getElementById('los-panel');
          view.ui.add(losPanel, 'top-right');
          losPanel.classList.remove('hide');

          //
          // LOS LIST //
          //
          const losListPanel = document.getElementById('los-list-panel');

          const createLOSNodeInfos = () => {
            const losNode = domConstruct.create('div', { className: 'los-node selected' }, losListPanel)
            const infoNode = domConstruct.create('span', {}, losNode);
            const removeNode = domConstruct.create('span', { title: 'remove LOS', className: 'icon-ui-trash icon-ui-flush icon-ui-red right' }, losNode);
            const clearNode = domConstruct.create('span', { title: 'clear targets', className: 'icon-ui-close icon-ui-orange right' }, losNode);
            return { losNode, infoNode, clearNode, removeNode };
          };

          //
          // LOS INFOS //
          //
          const losInfos = [];

          const activateLOS = (losInfo) => {
            losInfos.forEach(deactivateLOS);
            if(losInfo.los.targets.length){
              losInfo.los.continue();
            } else {
              losInfo.los.start();
            }
            losInfo.nodes.losNode.classList.add('selected');
          };

          const deactivateLOS = (losInfo) => {
            losInfo.los.stop();
            losInfo.nodes.losNode.classList.remove('selected');
          };

          const clearLOS = (losInfo) => {
            losInfo.los.stop();
            losInfo.los.clear();
            losInfo.nodes.losNode.classList.remove('selected');
          };

          const removeLOS = (losInfo) => {
            losInfo.los.stop();
            losInfo.los.clear();
            losInfo.remove();
            losListPanel.removeChild(losInfo.nodes.losNode);
            losInfos.splice(losInfos.findIndex(other => other === losInfo), 1);
          };

          const addLosBtn = document.getElementById('add-los-btn');
          addLosBtn.addEventListener('click', () => {

            let los = new LineOfSight({ view: view });
            watchUtils.whenEqualOnce(los.viewModel, 'state', 'ready', () => {

              const losInfo = {
                nodes: createLOSNodeInfos(),
                los: los.viewModel,
                remove: () => {
                  los.destroy();
                  los = null;
                }
              };
              const losID = losInfos.push(losInfo);

              losInfo.nodes.infoNode.innerHTML = `LOS: ${losID}  Targets: 0`;
              losInfo.los.watch('targets.length', targetCount => {
                losInfo.nodes.infoNode.innerHTML = `LOS:&nbsp;${losID}&nbsp;&nbsp;&nbsp;&nbsp;Targets:&nbsp;${targetCount}`;
              });

              losInfo.nodes.removeNode.addEventListener('click', (clickEvt) => {
                clickEvt.stopPropagation();
                removeLOS(losInfo);
              });

              losInfo.nodes.clearNode.addEventListener('click', (clickEvt) => {
                clickEvt.stopPropagation();
                clearLOS(losInfo);
              });

              losInfo.nodes.losNode.addEventListener('click', () => {
                if(losInfo.nodes.losNode.classList.toggle('selected')){
                  activateLOS(losInfo);
                } else {
                  deactivateLOS(losInfo);
                }
              });
              activateLOS(losInfo);

            });

          });

          resolve();
        });
      });

    }

  });
});
