sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/BusyIndicator",
	"sap/ui/model/Filter",
	'sap/ui/core/Fragment'
], function (Controller, BusyIndicator, Filter, Fragment) {
	"use strict";

	return Controller.extend("CostRoll.Z_FICO_IMACIPO_CR.controller.Master", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf CostRoll.Z_FICO_IMACIPO_CR.view.Master
		 */
		onInit: function () {
			this._initSmartTable(this);
			this._oView = this.getView();

			// Component reference
			this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
			this.oRouter = this.getOwnerComponent().getRouter();
			this.onInit = true;
			BusyIndicator.show();
			this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen = false;
			this.oRouter.getRoute("master").attachPatternMatched(this._onRequestNumberMatched, this);
			var that = this;

			that._oComponent.getModel("oDataModelNGD").read("/MyInboxSet", {
				success: function (data) {
					that._oComponent.getModel("tableEntriesModel").setData({
						MyInboxSet: data.results,
						MyInboxSetLength: data.results.length
					});
					that._oComponent.getModel("tableEntriesModel").setSizeLimit(200000);
					that._oComponent.getModel("tableEntriesModel").refresh(true);
					BusyIndicator.hide();
				},
				error: function (error) {
					BusyIndicator.hide();
				}
			});
			var requestNumber = "";
			var a = that;
			BusyIndicator.show();
			that._oComponent.getModel("oDataModelNGD").read("/UserDetailsSet('" + requestNumber + "')", {
				success: function (data) {
					var obj = a._oComponent.getModel("fieldHandlingModel").getData();
					obj.UserRole = data.UserRole;
					obj.UserDetails = data;
					a._oComponent.getModel('fieldHandlingModel').refresh(true);
					if (obj.UserRole === "INVALID") {
						that.oRouter.navTo("master", {
							layout: "OneColumn"
						});
					}
					BusyIndicator.hide();
				},
				error: function (error) {
					BusyIndicator.hide();
				}
			});

		},
		_onRequestNumberMatched: function () {
			if (this.onInit === false) {
				var that = this;
				if (this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen === false) {
					BusyIndicator.hide();
					return;
				}
				BusyIndicator.show();
				that._oComponent.getModel("oDataModelNGD").read("/MyInboxSet", {
					success: function (data) {
						var obj = that._oComponent.getModel("tableEntriesModel").getData();
						obj.MyInboxSet = data.results;
						obj.MyInboxSetLength = data.results.length;
						that._oComponent.getModel("tableEntriesModel").setSizeLimit(200000);
						that._oComponent.getModel("tableEntriesModel").refresh(true);
						BusyIndicator.hide();
					},
					error: function (error) {
						BusyIndicator.hide();
					}
				});
			} else {
				this.onInit = false;
			}
		},
		onAdd: function () {
			this.oRouter = this.getOwnerComponent().getRouter();
			BusyIndicator.show();
			var that = this;
			var promise = new Promise(function (resolve, reject) {
				that.oRouter.navTo("detail", {
					layout: "MidColumnFullScreen"
				});
			});
			promise.then(
				BusyIndicator.hide()
			);
		},
		// This is triggered when an line item is pressed in the view.
		onListItemPress: function (oEvent) {
			var itemObj = oEvent.getSource().getModel('tableEntriesModel').getProperty(oEvent.getSource().getBindingContext("tableEntriesModel")
				.getPath());
			this.oRouter = this.getOwnerComponent().getRouter();
			this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen = true;
			this.oRouter.navTo("detail", {
				layout: "TwoColumnsMidExpanded",
				requestNumber: itemObj.RequestNumber
			});
		},

		// This method is used to fetch all the posted records for the user.
		onShowDashboard: function (oEvent) {
			BusyIndicator.show(0);
			switch (this._oComponent.getModel("fieldHandlingModel").getData().showMyDashboard) {
			case true:
				this._oComponent.getModel("fieldHandlingModel").getData().showMyDashboard = false;
				this._oComponent.getModel("fieldHandlingModel").getData().showMyInbox = true;
				BusyIndicator.hide();
				break;
			case false:
				this._oComponent.getModel("fieldHandlingModel").getData().showMyDashboard = true;
				this._oComponent.getModel("fieldHandlingModel").getData().showMyInbox = false;
				BusyIndicator.hide();
				break;
			}
			var i18n = this.getView().getModel("i18n").getResourceBundle();
			if (oEvent.getSource().getPressed() === true) {
				oEvent.getSource().setText(i18n.getText("MyInbox"));
			} else {
				oEvent.getSource().setText(i18n.getText("MyDashboard"));
			}
			this._oComponent.getModel("defaultValueModel").getData().DateValue = "";
			this._oComponent.getModel("defaultValueModel").refresh(true);
			this._oComponent.getModel("fieldHandlingModel").refresh(true);
		},
		// This is triggered when user goes for a search. Here the user can search Request number only
		onSearch: function (oEvent) {
			// Fetching the search value
			var searchValue = oEvent.getSource().getValue();
			var creationDate = new Date(searchValue);
			// creationDate = creationDate.getTime();
			// Getting the table reference
			var tableBinding = oEvent.getSource().getParent().getParent().getBinding('items');
			// Handling the filter array
			var oFilters = [];
			if (searchValue) {
				var filter = new Filter("RequestNumber", sap.ui.model.FilterOperator.Contains, searchValue);
				oFilters.push(filter);
				filter = new Filter("RequestTypeDesc", sap.ui.model.FilterOperator.Contains, searchValue);
				oFilters.push(filter);
				filter = new Filter("MFGPlant", sap.ui.model.FilterOperator.Contains, searchValue);
				oFilters.push(filter);
				filter = new Filter("Requestorname", sap.ui.model.FilterOperator.Contains, searchValue);
				oFilters.push(filter);
				filter = new Filter("RequestStatusDesc", sap.ui.model.FilterOperator.Contains, searchValue);
				oFilters.push(filter);
				filter = new Filter("QueueOwner", sap.ui.model.FilterOperator.Contains, searchValue);
				oFilters.push(filter);
				if (!isNaN(creationDate.valueOf())) {
					filter = new Filter("CreationDate", sap.ui.model.FilterOperator.EQ, creationDate);
					oFilters.push(filter);
				}
				var filters = new sap.ui.model.Filter(oFilters, false);
				tableBinding.filter(filters);
			} else {
				tableBinding.filter(oFilters);
			}

		},
		// This is triggered when user wants to sort the list by clicking on the sort button. This will open the fragment with the sort parameters
		onSort: function (oEvent) {
			if (!this._viewSettingDialog) {
				this._viewSettingDialog = sap.ui.xmlfragment("CostRoll.Z_FICO_IMACIPO_CR.view.fragment.ViewSettingsDialog", this);
				this.getView().addDependent(this._viewSettingDialog);
			}
			this._viewSettingDialog.open();
		},
		handleConfirmOfVSD: function (oEvent) {
			var SortingFlag = false;
			if (oEvent.getSource().getSortDescending()) {
				SortingFlag = true;
			}
			var fetchSortList = [],
				SortingPath,
				fnGroup = false;
			fetchSortList = oEvent.getSource().getSortItems();
			switch (oEvent.getSource().getSelectedSortItem()) {
			case fetchSortList[0].getId():
				// Request Number
				SortingPath = "RequestNumber";
				fnGroup = false;
				break;
			case fetchSortList[1].getId():
				// Creation Date
				SortingPath = "CreationDate";
				fnGroup = function (oContext) {
					return oContext.getProperty("CreationDate");
				};
				break;
			case fetchSortList[2].getId():
				// Request Status
				SortingPath = "StatusDescript";
				fnGroup = function (oContext) {
					return oContext.getProperty("StatusDescript");
				};
				break;
			case fetchSortList[3].getId():
				break;
			default:
			}
			var oSorter = new sap.ui.model.Sorter({
				path: SortingPath,
				descending: SortingFlag,
				group: fnGroup
			});
			this.byId("MyInboxTable").getBinding("items").sort(oSorter);
		},
		_initSmartTable: function (that) {
			var view = that.getView();
			view.setModel(that.getOwnerComponent().getModel("oDataModelNGD"));
		},
		// Event handler method for selectionChange event of Table
		// To handle the navigation to Detail page when request is pressed in Dashboard Table
		onDashboardItemSelect: function (oEvent) {
			var RequestNumber = oEvent.getParameters().listItem.getBindingContext().getObject().Reqnum;
			this.oRouter = this.getOwnerComponent().getRouter();
			this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen = true;
			this.oRouter.navTo("detail", {
				layout: "TwoColumnsMidExpanded",
				requestNumber: RequestNumber
			});
		},
		onLinkClick: function (oEvent) {
			var oLink = oEvent.getSource(),
				oView = this.getView();
			var oPath = "tableEntriesModel>" + oEvent.getSource().getBindingContext("tableEntriesModel").getPath();
			var oRequestNumber = oEvent.getSource().getModel('tableEntriesModel').getProperty(oEvent.getSource().getBindingContext(
				"tableEntriesModel").getPath()).RequestNumber;
			var oId = "i" + oRequestNumber;
			if (!this._pPopover) {
				this._pPopover = Fragment.load({
					id: oId,
					name: "CostRoll.Z_FICO_IMACIPO_CR.view.fragment.QueueOwner",
					controller: this
				}).then(function (oPopover) {
					oView.addDependent(oPopover);
					oPopover.bindElement(oPath);
					return oPopover;
				});
			}
			this._pPopover.then(function (oPopover) {
				oPopover.openBy(oLink);
			});
		},
		onQueueOwnersAfterclose: function (that) {
			if (this._pPopover) {
				this._pPopover = undefined;
			}
		},
		onRefreshMyInbox: function (oEvent) {
			var that = this;
			BusyIndicator.show();
			that._oComponent.getModel("oDataModelNGD").read("/MyInboxSet", {
				success: function (data) {
					var obj = that._oComponent.getModel("tableEntriesModel").getData();
					obj.MyInboxSet = data.results;
					obj.MyInboxSetLength = data.results.length;
					that._oComponent.getModel("tableEntriesModel").setSizeLimit(200000);
					that._oComponent.getModel("tableEntriesModel").refresh(true);
					BusyIndicator.hide();
				},
				error: function (error) {
					BusyIndicator.hide();
				}
			});
		}
	});

});