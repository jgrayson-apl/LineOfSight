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
  "./FresnelZoneAnalysis"
], function(calcite, declare, ApplicationBase,
            i18n, itemUtils, domHelper, domConstruct,
            IdentityManager, Evented, watchUtils, promiseUtils, Portal,
            Home, FresnelZoneAnalysis){

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

      // TITLE //
      document.getElementById("app-title-node").innerHTML = config.title;

      /*// LOADING //
      const updating_node = domConstruct.create("div", { className: "view-loading-node loader" });
      domConstruct.create("div", { className: "loader-bars" }, updating_node);
      domConstruct.create("div", { className: "loader-text font-size--3 text-white", innerHTML: "Updating..." }, updating_node);
      view.ui.add(updating_node, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        updating_node.classList.toggle("is-active", updating);
      });*/

      // USER SIGN IN //
      return this.initializeUserSignIn().catch(console.warn).then(() => {

        // STARTUP DIALOG //
        this.initializeStartupDialog();

        // POPUP DOCKING OPTIONS //
        view.popup.dockEnabled = true;
        view.popup.dockOptions = {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-center"
        };

        // HOME //
        const home = new Home({ view: view });
        view.ui.add(home, { position: "top-left", index: 0 });

        // APPLICATION READY //
        this.applicationReady(view);

      });

    },

    /**
     *
     */
    initializeStartupDialog: function(){

      // APP ID //
      const appID = `show-startup-${location.pathname.split('/')[2]}`;

      // STARTUP DIALOG //
      const showStartup = localStorage.getItem(appID) || 'show';
      if(showStartup === 'show'){
        calcite.bus.emit('modal:open', { id: 'app-details-dialog' });
      }

      // HIDE STARTUP DIALOG //
      const hideStartupInput = document.getElementById('hide-startup-input');
      hideStartupInput.checked = (showStartup === 'hide');
      hideStartupInput.addEventListener('change', () => {
        localStorage.setItem(appID, hideStartupInput.checked ? 'hide' : 'show');
      });

    },

    /**
     *
     * @returns {*}
     */
    initializeUserSignIn: function(){

      const checkSignInStatus = () => {
        return IdentityManager.checkSignInStatus(this.base.portal.url).then(userSignIn).catch(userSignOut).then();
      };
      IdentityManager.on("credential-create", checkSignInStatus);

      // SIGN IN NODE //
      const signInNode = document.getElementById("sign-in-node");
      const userNode = document.getElementById("user-node");

      // UPDATE UI //
      const updateSignInUI = () => {
        if(this.base.portal.user){
          document.getElementById("user-firstname-node").innerHTML = this.base.portal.user.fullName.split(" ")[0];
          document.getElementById("user-fullname-node").innerHTML = this.base.portal.user.fullName;
          document.getElementById("username-node").innerHTML = this.base.portal.user.username;
          document.getElementById("user-thumb-node").src = this.base.portal.user.thumbnailUrl;
          signInNode.classList.add('hide');
          userNode.classList.remove('hide');
        } else {
          signInNode.classList.remove('hide');
          userNode.classList.add('hide');
        }
        return promiseUtils.resolve();
      };

      // SIGN IN //
      const userSignIn = () => {
        this.base.portal = new Portal({ url: this.base.config.portalUrl, authMode: "immediate" });
        return this.base.portal.load().then(() => {
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).catch(console.warn).then();
      };

      // SIGN OUT //
      const userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.base.portal = new Portal({});
        return this.base.portal.load().then(() => {
          this.base.portal.user = null;
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).catch(console.warn).then();

      };

      // USER SIGN IN //
      signInNode.addEventListener("click", userSignIn);

      // SIGN OUT NODE //
      const signOutNode = document.getElementById("sign-out-node");
      if(signOutNode){
        signOutNode.addEventListener("click", userSignOut);
      }

      return checkSignInStatus();
    },


    /**
     * APPLICATION READY
     *
     * @param view
     */
    applicationReady: function(view){

      this.initializeFresnelZonesAnalysis(view);

    },

    /**
     *
     * @param view
     */
    initializeFresnelZonesAnalysis: function(view){

      // FRESNEL ZONES ANALYSIS //
      const fresnelZoneAnalysis = new FresnelZoneAnalysis({
        container: document.getElementById('side-panel'),
        view: view
      });

      const addLocationBtn = domConstruct.create('button', { className: 'btn btn-white', innerHTML: 'Add Location' });
      view.ui.add(addLocationBtn, 'top-right');

      let clickEvtHandle = null;
      addLocationBtn.addEventListener('click', () => {
        addLocationBtn.classList.toggle('btn-theme');
        if(addLocationBtn.classList.toggle('icon-ui-check-mark')){
          view.container.style.cursor = 'crosshair';

          clickEvtHandle && clickEvtHandle.remove();
          clickEvtHandle = view.on('click', clickEvt => {
            clickEvt.stopPropagation();

            view.container.style.cursor = 'wait';
            addLocationBtn.classList.add('btn-disabled');
            fresnelZoneAnalysis.addSource(clickEvt.mapPoint).then(() => {
              addLocationBtn.classList.remove('btn-disabled');
              view.container.style.cursor = 'crosshair';
            });

          });

        } else {
          view.container.style.cursor = 'default';
        }
      });


    }

  });
});
