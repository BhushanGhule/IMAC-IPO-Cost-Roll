sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"CostRoll/Z_FICO_IMACIPO_CR/model/models",
	"sap/ui/model/json/JSONModel",
	"sap/f/FlexibleColumnLayoutSemanticHelper",
	"sap/base/util/UriParameters",
	"sap/f/library"
], function (UIComponent, Device, models, JSONModel, FlexibleColumnLayoutSemanticHelper, UriParameters, library) {
	"use strict";
	var LayoutType = library.LayoutType;
	return UIComponent.extend("CostRoll.Z_FICO_IMACIPO_CR.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			var oModel = new JSONModel();
			this.setModel(oModel);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
		},
		getHelper: function () {
			var oCostRoll = this.getRootControl().byId("costroll"),
				oParams = UriParameters.fromQuery(location.search),
				oSettings = {
					defaultTwoColumnLayoutType: LayoutType.TwoColumnsMidExpanded,
					defaultThreeColumnLayoutType: LayoutType.ThreeColumnsMidExpanded,
					mode: oParams.get("mode"),
					maxColumnsCount: oParams.get("max")
				};

			return FlexibleColumnLayoutSemanticHelper.getInstanceFor(oCostRoll, oSettings);
		}
	});
});