sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/m/MessageToast",
	"sap/ui/core/BusyIndicator",
	"CostRoll/Z_FICO_IMACIPO_CR/util/FactoryFunctions",
	"sap/ui/export/library",
	"sap/ui/export/Spreadsheet",
	"sap/m/MessagePopover",
	"sap/m/MessageBox"
], function (Controller, JSONModel, Filter, MessageToast, BusyIndicator, formatter, exportLibrary, Spreadsheet, MessagePopover,
	MessageBox) {
	"use strict";
	return Controller.extend("CostRoll.Z_FICO_IMACIPO_CR.controller.Detail", {

		formatter: formatter,
		onInit: function () {
			var oExitButton = this.getView().byId("exitFullScreenBtn"),
				oEnterButton = this.getView().byId("enterFullScreenBtn");

			this.oRouter = this.getOwnerComponent().getRouter();
			this.oModel = this.getOwnerComponent().getModel();
			this._oView = this.getView();

			// Component reference
			this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
			this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen = true;
			this._oComponent.getModel("defaultValueModel").getData().DetailHeader.CostingDate = new Date();
			// attaching the hook methods for any pattern change
			this.oRouter.getRoute("master").attachPatternMatched(this._onRequestNumberMatched, this);
			this.oRouter.getRoute("detail").attachPatternMatched(this._onRequestNumberMatched, this);
			this._setInitalDetailsScreen();
			[oExitButton, oEnterButton].forEach(function (oButton) {
				oButton.addEventDelegate({
					onAfterRendering: function () {
						if (this.bFocusFullScreenButton) {
							this.bFocusFullScreenButton = false;
							oButton.focus();
						}
					}.bind(this)
				});
			}, this);
		},
		// This is used to enter the full screen		
		handleFullScreen: function () {
			this.bFocusFullScreenButton = true;
			this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen = false;
			var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.oRouter.navTo("detail", {
				layout: sNextLayout,
				requestNumber: this._requestNumber,
				screenChanged: true
			});
		},
		// This is used to exit the full screen
		handleExitFullScreen: function () {
			this.bFocusFullScreenButton = true;
			this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen = false;
			var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
			this.oRouter.navTo("detail", {
				layout: sNextLayout,
				requestNumber: this._requestNumber,
				screenChanged: true
			});
		},
		// This is used to close the full screen of detail screen
		handleClose: function () {
			var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
			this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen = true;
			this.oRouter.navTo("master", {
				layout: sNextLayout
			});
		},

		_onRequestNumberMatched: function (oEvent) {
			this._initRequest();
			this._requestNumber = oEvent.getParameter("arguments").requestNumber || "0";
			var screenChanged = oEvent.getParameter("arguments").screenChanged;

			if (this._requestNumber !== "0") {
				// this is for existing reques
				if (screenChanged !== "true") {
					this._handleViewDetailLoad(this._requestNumber, this);
				}
			} else {
				// This is for New request
				this._onCreateNewRequest(this, screenChanged);
			}
		},
		_onCreateNewRequest: function (othis, screenChanged) {
			var that = othis;
			if (screenChanged !== "true") {
				var promise = new Promise(function (resolve, reject) {
					that._handleCreateViewDataLoad(that);
				});
				promise.then(
					that._handleOnDetailLoad(that, "New")
				);

				var obj = that._oComponent.getModel("fieldHandlingModel").getData();
				obj.createRequest = true;
				obj.createRequestBut = true;
				obj.displayNotes = true;
				obj.Draft = true;
				that._oComponent.getModel("fieldHandlingModel").refresh(true);
			}
		},
		// This is used to set the selected section.
		_handleOnDetailLoad: function (that, requestType) {
			var obj = that._oComponent.getModel("fieldHandlingModel").getData();
			if (requestType === "Existing") {
				that.getView().byId("ObjectPageLayout").setSelectedSection(that.getView().byId("MaterialLst"));
				obj.MaterialHeader = false;
			} else if (requestType === "New") {
				that.getView().byId("ObjectPageLayout").setSelectedSection(that.getView().byId("MaterialHeader"));
				obj.MaterialHeader = true;
			}
			that._oComponent.getModel("fieldHandlingModel").refresh(true);
		},
		_handleViewDetailLoad: function (requestNumber, that) {
			BusyIndicator.show();
			var a = that;
			this._oComponent.getModel("oDataModelNGD").read("/ZFICO_C_COSTROLL('" + requestNumber + "')/Set", {
				urlParameters: {
					"$expand": "to_items,to_log,to_CaseCon"
				},
				method: "GET",
				success: function (data) {
					BusyIndicator.hide();
					var obj = a._oComponent.getModel("defaultValueModel").getData();
					var objButton = a._oComponent.getModel("fieldHandlingModel").getData();
					var errorOccured = false;
					obj.RequestItem = data.results[0].to_items.results;
					for (var iRowIndex = 0; iRowIndex < obj.RequestItem.length; iRowIndex++) {
						var validationError = [];
						obj.RequestItem[iRowIndex].UserDetails = objButton.UserDetails;
						obj.RequestItem[iRowIndex].Initiator = data.results[0].Initiator;
						obj.RequestItem[iRowIndex].Status = data.results[0].Status;
						obj.RequestItem[iRowIndex].SequenceNumber = Number(obj.RequestItem[iRowIndex].SequenceNumber);
						if (obj.RequestItem[iRowIndex].ApproverErr !== "" && (data.results[0].Status !== "001" && data.results[0].Status !== "004")) {
							var ApproverErr = [];
							errorOccured = true;
							ApproverErr.push({
								fieldname: "General",
								type: "Error",
								message: obj.RequestItem[iRowIndex].ApproverErr
							});
							validationError = validationError.concat(ApproverErr);
						}
						if (obj.RequestItem[iRowIndex].ValidationError !== "") {
							validationError = validationError.concat(JSON.parse(obj.RequestItem[iRowIndex].ValidationError));
						}
						if (validationError.length !== 0) {
							objButton.displayNotes = true;
							obj.RequestItem[iRowIndex].ValidationError = validationError;
						} else {
							obj.RequestItem[iRowIndex].ValidationError = "";
						}
						if (obj.RequestItem[iRowIndex].Posting !== "") {
							objButton.PostingStatus = true;
						}
					}
					obj.refRequestItem = obj.RequestItem;
					obj.AuditDataItems = data.results[0].to_log.results;
					obj.CaseContentItems = data.results[0].to_CaseCon.results;
					delete data.results[0].to_items;
					delete data.results[0].to_log;
					delete data.results[0].to_CaseCon;
					delete data.results[0].__metadata;
					delete data.results[0].i_reqnum;
					delete data.results[0].Parameters;

					obj.DetailHeader = data.results[0];
					obj.HeaderTitle = "Request Number :" + data.results[0].RequestNumber;
					if (data.results[0].Status === "001" || data.results[0].Status === "004") {
						a._setHandleSubmit(a);
					}

					a._handleOnDetailLoad(a, "Existing");
					var existsInMyInbox = "";
					var MyInboxSet = a._oComponent.getModel("tableEntriesModel").getData().MyInboxSet;
					if (MyInboxSet) {
						if (MyInboxSet.findIndex(item => item.RequestNumber === obj.DetailHeader.RequestNumber) === -1) {
							existsInMyInbox = "NOTFOUND";
						} else {
							existsInMyInbox = "FOUND";
						}
					}
					if (existsInMyInbox === "FOUND") {
						if (objButton.UserDetails.PuApprover === true && data.results[0].Status === "002" && objButton.UserDetails.Username !== data.results[
								0].Initiator) {
							if (errorOccured === false) {
								objButton.Approver = true;
							}
							objButton.Rejecter = true;
						} else if (objButton.UserDetails.FiApprover === true && data.results[0].Status === "003") {
							a._handleFinanceButtons(obj.RequestItem, a);
						} else if (objButton.UserDetails.SME === true && data.results[0].Status === "002" && objButton.UserDetails.Username !== data.results[
								0].Initiator) {
							if (errorOccured === false) {
								objButton.Approver = true;
							}
							objButton.Rejecter = true;
						} else if (objButton.UserDetails.Buyer === true && objButton.UserDetails.Username === data.results[0].Initiator &&
							(data.results[0].Status === "004" || data.results[0].Status === "001")) {
							obj.RequestItem.forEach(function (item) {
								item.changed = true;
							});
							a._oComponent.getModel("defaultValueModel").getData().Count.Count = Math.max(...obj.RequestItem.map(item => item.SequenceNumber));
							objButton.Withdraw = true;
							if (data.results[0].Status === "001") {
								objButton.Draft = true;
							}
							objButton.createRequest = true;
						}
					} else {
						objButton.createRequest = false;
						objButton.createRequestBut = false;
						objButton.Approver = false;
						objButton.Rejecter = false;
						objButton.Post = false;
						objButton.Close = false;
						objButton.ForceClose = false;
						objButton.Withdraw = false;
						objButton.Submit = false;
						objButton.Draft = false;
						objButton.SendEmail = false;
					}
					a._oComponent.getModel("fieldHandlingModel").setData(objButton);
					a._oComponent.getModel("fieldHandlingModel").refresh(true);
					a._oComponent.getModel("defaultValueModel").setData(obj);
					a._oComponent.getModel("defaultValueModel").refresh(true);
					if (objButton.UserDetails.Buyer === true && objButton.UserDetails.Username === data.results[0].Initiator &&
						(data.results[0].Status === "004" || data.results[0].Status === "001")) {
						a._initDropDowns(a);
						a._handleOnDetailLoad(a, "New");
					}
				},
				error: function (error) {
					BusyIndicator.hide();
				}

			});
			var oFilters = []
			if (requestNumber) {
				var filter = new Filter("RequestNumber", "EQ", requestNumber);
				oFilters.push(filter);
			}
			this._fetchAttachmentDetails(that, oFilters);
		},
		_handleCreateViewDataLoad: function (that) {
			var obj = this._oComponent.getModel("defaultValueModel").getData();
			this._oComponent.getModel("oDataModelNGD").read("/SourceSet()", {
				success: function (data) {
					obj.SourceSet = data.results;

				},
				error: function (error) {

				}
			});
			obj.DetailHeader = {};
			obj.RequestItem = [];
			obj.refRequestItem = [];
			obj.AttachmentList = [];
			obj.AuditDataItems = [];
			obj.CaseContentItems = [];
			obj.RemarkText = "";
			obj.AttahmentUploadCounter = 10;
			obj.AttahmentUploadVisibility = true;
			obj.AttachmentMaxOutText = false;
			obj.HeaderTitle = "Request Number : <Yet to be assigned>";
			obj.DetailHeader.CostingDate = new Date();
			obj.DetailHeader.Status = "001";
			obj.DetailHeader.RequestTypeID = "001";
			obj.DetailHeader.RequestTypeDesc = "New Material Costing";
			obj.DetailHeader.ReasonCodeID = "001";
			obj.DetailHeader.ReasonCodeDesc = "New Mapped Part";
			obj.DetailHeader.StatusDesc = "New";
			this._handleReasonCodeList(obj.DetailHeader.RequestTypeID, this);
			this._oComponent.getModel("defaultValueModel").getData().Count.Count = 0;
			this.getView().byId("RequestTypeid").setValue(obj.DetailHeader.RequestTypeDesc);
			this.getView().byId("ReasonCodeid").setValue(obj.DetailHeader.ReasonCodeDesc);
			this.getView().byId("PostingPlantid").setValue("");
			this.getView().byId("MfgPlantid").setValue("");
			this._oComponent.getModel("defaultValueModel").refresh(true);

		},
		onUploadDataPress: function () {
			if (!this._TextDialog) {
				this._TextDialog = sap.ui.xmlfragment("CostRoll.Z_FICO_IMACIPO_CR.view.fragment.UploadText", this);
				this.getView().addDependent(this._TextDialog);
			}
			this._TextDialog.open();
		},
		onCloseUpload: function (oEvent) {
			this._TextDialog.close();
		},
		onTextAfterclose: function (oEvent) {
			this._TextDialog.destroy();
			this._TextDialog = undefined;
		},
		onNewRowPress: function () {

			var that = this;
			var obj = that._oComponent.getModel("defaultValueModel").getData();
			var newRow = [];

			newRow.push({
				PostingPlant: "",
				RequestNumber: "",
				MfgPlant: "",
				SequenceNumber: this.getSeqnum(),
				PartNo: "",
				ValidationNotes: "",
				SupplierName: "",
				MPN: "",
				CostRollPrice: "",
				Source: "",
				QA: "",
				CommonPart: "No",
				SGProfitCenter: "",
				MFGSiteIRPrice: "",
				MFGIRPricePer: "",
				ExistingMfgSiteStdCost: "",
				ExistingMfgSiteStdCostPer: "",
				ExistingSG03SG05StdCost: "",
				ExistingSG03SG05StdCostPer: "",
				ExistingSG03SG05PlannedPrice: "",
				FuturePrice: "",
				FuturePriceDate: "",
				DeletionIndicator: "",
				OldNew: "NEW",
				Status: "001",
				UserDetails: that._oComponent.getModel("fieldHandlingModel").getData().UserDetails,
				Initiator: that._oComponent.getModel("fieldHandlingModel").getData().UserDetails.Username
			});
			obj.RequestItem = obj.RequestItem.concat(newRow);
			that._oComponent.getModel("defaultValueModel").refresh(true);

		},
		onUploadText: function (oEvent) {
			BusyIndicator.show();
			var oText = sap.ui.getCore().byId("iTextUpload").getValue();
			var oTextTable = oText.split("\n");
			var that = this;
			var obj = that._oComponent.getModel("defaultValueModel").getData();
			var newRow = [];
			for (var iRowIndex = 0; iRowIndex < oTextTable.length; iRowIndex++) {
				if (oTextTable[iRowIndex] !== "") {
					var oCellText = oTextTable[iRowIndex].split("\t");
					var PartNo = "",
						SupplierName = "",
						MPN = "",
						CostRollPrice = "",
						Source = "",
						QA = "",
						CommonPart = "";
					for (var icellIndex = 0; icellIndex < oCellText.length; icellIndex++) {
						if (icellIndex === 0) {
							PartNo = oCellText[0];
						} else if (icellIndex === 1) {
							SupplierName = oCellText[1];
						} else if (icellIndex === 2) {
							MPN = oCellText[2];
						} else if (icellIndex === 3) {
							CostRollPrice = oCellText[3];
							CostRollPrice = this._formatNumberPrice(CostRollPrice);
						} else if (icellIndex === 4) {
							Source = oCellText[4];
						} else if (icellIndex === 5) {
							QA = oCellText[5];
							QA = this._formatNumberQA(QA);
						} else if (icellIndex === 6) {
							CommonPart = oCellText[6];
							if (CommonPart !== undefined) {
								if (CommonPart.toUpperCase() === "YES") {
									CommonPart = "Yes";
								} else {
									CommonPart = "No";
								}
							}
						}
					}

					newRow.push({
						PostingPlant: "",
						RequestNumber: "",
						MfgPlant: "",
						SequenceNumber: this.getSeqnum(),
						PartNo: PartNo,
						ValidationNotes: "",
						SupplierName: SupplierName,
						MPN: MPN,
						CostRollPrice: CostRollPrice,
						Source: Source,
						QA: QA,
						CommonPart: CommonPart,
						SGProfitCenter: "",
						MFGSiteIRPrice: "",
						MFGIRPricePer: "",
						ExistingMfgSiteStdCost: "",
						ExistingMfgSiteStdCostPer: "",
						ExistingSG03SG05StdCost: "",
						ExistingSG03SG05StdCostPer: "",
						ExistingSG03SG05PlannedPrice: "",
						FuturePrice: "",
						FuturePriceDate: "",
						DeletionIndicator: "",
						changed: true,
						OldNew: "NEW",
						Status: "001",
						UserDetails: that._oComponent.getModel("fieldHandlingModel").getData().UserDetails,
						Initiator: that._oComponent.getModel("fieldHandlingModel").getData().UserDetails.Username
					});
				}
			}
			obj.RequestItem = obj.RequestItem.concat(newRow);
			that._oComponent.getModel("defaultValueModel").refresh(true);
			sap.ui.getCore().byId("iTextUpload").setValue("");
			this._TextDialog.close();
			this.fetchDetails();
			BusyIndicator.hide()
		},
		onSuggestionItemSelected: function (oEvent) {
			var obj = {},
				reff;
			obj = this._oComponent.getModel("defaultValueModel").getData();
			reff = oEvent.getSource().getSelectedKey();
			if (oEvent.getSource().getCustomData()[0].getValue() === "RequestType") {
				obj.DetailHeader.RequestTypeDesc = oEvent.getSource()._getSelectedItemText();
				obj.DetailHeader.RequestTypeID = oEvent.getSource().getSelectedKey();
				obj.DetailHeader.ReasonCodeList = {};
				obj.DetailHeader.ReasonCodeDesc = "";
				obj.DetailHeader.ReasonCodeID = "";
				this.getView().byId("ReasonCodeid").clearSelection();
				this.getView().byId("ReasonCodeid").setValue("");
				BusyIndicator.show();
				this._handleReasonCodeList(reff, this);
			} else if (oEvent.getSource().getCustomData()[0].getValue() === "ReasonCode") {
				obj.DetailHeader.ReasonCodeDesc = oEvent.getSource()._getSelectedItemText();
				obj.DetailHeader.ReasonCodeID = oEvent.getSource().getSelectedKey();
			} else if (oEvent.getSource().getCustomData()[0].getValue() === "PostingPlant") {
				obj.DetailHeader.PostingPlant = oEvent.getSource().getSelectedKey();
			} else if (oEvent.getSource().getCustomData()[0].getValue() === "MfgPlant") {
				obj.DetailHeader.MfgPlant = oEvent.getSource().getSelectedKey();
			}
			for (var iRowIndex = 0; iRowIndex < obj.RequestItem.length; iRowIndex++) {
				obj.RequestItem[iRowIndex].changed = true;
			}
			this._oComponent.getModel("defaultValueModel").setData(obj);
		},
		_handleReasonCodeList: function (requestType, that) {
			BusyIndicator.show();
			var oFilters = [];
			if (requestType) {
				var filter = new Filter("RequestTypeID", "EQ", requestType);
				oFilters.push(filter);
			}
			var a = that;
			var oReasonCodeID = a._oComponent.getModel("defaultValueModel").getData().DetailHeader.ReasonCodeID;
			this._oComponent.getModel("oDataModelNGD").read("/ReasonCodeSet", {
				filters: oFilters,
				success: function (data) {
					var obj = a._oComponent.getModel("defaultValueModel").getData();
					obj.ReasonCodeList = data.results;
					obj.DetailHeader.ReasonCodeID = oReasonCodeID;
					a._oComponent.getModel("defaultValueModel").setData(obj);
					a._oComponent.getModel("defaultValueModel").refresh(true);
					BusyIndicator.hide();
				},
				error: function (error) {
					BusyIndicator.hide();
				}
			});
		},
		deleteMaterial: function (oEvent) {

			var deletedSequenceNumber = oEvent.getParameter("listItem").getModel("defaultValueModel").getProperty(oEvent.getParameter(
				"listItem").getBindingContext("defaultValueModel").getPath()).SequenceNumber;

			var RequestItem = this._oComponent.getModel("defaultValueModel").getData().RequestItem,
				finalArr = [];
			RequestItem.forEach(function (item) {
				if (deletedSequenceNumber !== item.SequenceNumber) {
					finalArr.push(item);
				}
			});
			this._oComponent.getModel("defaultValueModel").getData().RequestItem = finalArr;
			this._oComponent.getModel("defaultValueModel").refresh(true);

		},
		getSeqnum: function (id) {
			var oCount = this._oComponent.getModel("defaultValueModel").getData().Count.Count;
			oCount = Number(oCount) + 1;
			this._oComponent.getModel("defaultValueModel").getData().Count.Count = oCount;
			return oCount;
		},
		createColumnConfig: function () {
			var EdmType = exportLibrary.EdmType;
			return [{
				label: "Part No.",
				property: "PartNo",
				type: EdmType.String,
				width: "30"
			}, {
				label: "Supplier(VC-Name)",
				property: "Supplier",
				type: EdmType.String,
				width: "30"
			}, {
				label: "MPN",
				property: "MPN",
				type: EdmType.String,
				width: "20"
			}, {
				label: "Cost Roll Price(per 1000)",
				property: "CostRollPrice",
				type: EdmType.Number,
				width: "10"
			}, {
				label: "Source(STR, SAT, RFQ, Site)",
				property: "Source",
				type: EdmType.String,
				width: "30"
			}, {
				label: "QA",
				property: "QA",
				type: EdmType.Number,
				width: "10"
			}, {
				label: "Common Part in SG03/SG05",
				property: "CommonPart",
				type: EdmType.String,
				width: "5"
			}];
		},

		onDownloadTemplate: function (oEvent) {
			var aCols, aData, oSettings, oSheet;
			aCols = this.createColumnConfig();
			aData = [];
			aData.push({});

			oSettings = {
				workbook: {
					columns: aCols
				},
				dataSource: aData,
				fileName: "Template.xlsx"
			};

			oSheet = new Spreadsheet(oSettings);
			oSheet.build()
				.then(function () {

				})
				.finally(oSheet.destroy);
		},
		fetchDetails: function (oEvent) {
			var obj = this._oComponent.getModel("defaultValueModel").getData();
			var PostingPlant = obj.DetailHeader.PostingPlant;
			var MfgPlant = obj.DetailHeader.MfgPlant;

			obj.RequestItem.forEach(function (RequestItem, index) {
				RequestItem.PostingPlant = PostingPlant;
				RequestItem.MfgPlant = MfgPlant;
			});
			this._oComponent.getModel("defaultValueModel").refresh(true);
		},

		_initDropDowns: function (that) {
			var obj = that._oComponent.getModel("defaultValueModel").getData();
			if (obj.SourceSet.length === 0 || obj.SourceSet.length === undefined) {
				that._oComponent.getModel("oDataModelNGD").read("/SourceSet()", {
					success: function (data) {
						obj.SourceSet = data.results;
						that._oComponent.getModel("defaultValueModel").setData(obj);
						that._oComponent.getModel("defaultValueModel").refresh(true);
					},
					error: function (error) {

					}
				});
			}
			that._handleReasonCodeList(obj.DetailHeader.RequestTypeID, that);
		},
		showDetails: function (oEvent) {
			var error;
			if (this._oComponent.getModel("fieldHandlingModel").getData().createRequest === true) {
				error = this._validateHeader();
				oEvent.getSource().getParent().getCells().forEach(function (oItem) {
					if (oItem.getMetadata()._sClassName === "sap.m.Input") {
						if (oItem.getValue() === "") {
							error = "X";
							oItem.setValueState(sap.ui.core.ValueState.Error);
							oItem.setShowValueStateMessage(false);
						} else {
							oItem.setValueState(sap.ui.core.ValueState.None);
						}
					} else if (oItem.getMetadata()._sClassName === "sap.m.Select") {
						if (oItem.getSelectedKey() === "") {
							error = "X";
							oItem.setValueState(sap.ui.core.ValueState.Error);
						} else {
							oItem.setValueState(sap.ui.core.ValueState.None);
						}
					}
				});

				if (error === "X") {
					MessageToast.show("Please fill value in the highlighted fields to view details");
				} else if (oEvent.getSource().getParent().getCells()[3].getValue() <= 0) {
					oEvent.getSource().getParent().getCells()[3].setValueState(sap.ui.core.ValueState.Error);
					oEvent.getSource().getParent().getCells()[3].setValueStateText("Cost Roll Price can not be zero");
					error = "X";
					MessageToast.show("Cost Roll Price can not be zero");
				}
			}
			if (!this._DetailsDialog && error !== "X") {
				this._DetailsDialog = sap.ui.xmlfragment("CostRoll.Z_FICO_IMACIPO_CR.view.fragment.Details", this);
				this.getView().addDependent(this._DetailsDialog);
				var selectItem = oEvent.getSource().getBindingContext("defaultValueModel").getObject();
				var detailsForm = sap.ui.getCore().byId("detailsForm");
				var oPath = "defaultValueModel>" + oEvent.getSource().getBindingContext("defaultValueModel").getPath();
				var itemNo = oEvent.getSource().getBindingContext("defaultValueModel").getPath().replace(/\D/g, "");
				if (oEvent.getSource().getBindingContext("defaultValueModel").getObject().changed === true) {
					BusyIndicator.show();
					this.readSingleItem(selectItem, itemNo);
				}
				detailsForm.bindElement({
					path: oPath
				});
			}
			this._DetailsDialog.open();

		},
		onCloseDetails: function (oEvent) {
			this._DetailsDialog.close();
		},
		detailsAfterclose: function (oEvent) {
			this._DetailsDialog.destroy();
			this._DetailsDialog = undefined;
		},
		onCommonPartSelect: function (oEvent) {
			if (oEvent.getParameter("selected") === true) {
				oEvent.getSource().getBindingContext("defaultValueModel").getObject().CommonPart = "Yes";
			} else {
				oEvent.getSource().getBindingContext("defaultValueModel").getObject().CommonPart = "No";
			}
			oEvent.getSource().getBindingContext("defaultValueModel").getObject().changed = true;
		},
		onCreatePress: function (oEvent) {
			var error = this._validate();
			if (error !== "X") {
				this.taskType = "Create";
				this._handleRemarkDialog(this);
			}
		},
		onSubmitPress: function (oEvent) {
			var error = this._validate();
			if (error !== "X") {
				this.taskType = "Resubmit";
				this._handleRemarkDialog(this);
			}
		},
		onValidate: function (oEvent) {
			var error = this._validate();
			if (error !== "X") {
				this._handleBatchProcess(this, "Validate");
			}
		},
		onDraftPress: function (oEvent) {
			var error = this._validate();
			if (error !== "X") {
				this.taskType = "Draft";
				this._handleRemarkDialog(this);
			}
		},
		onApprovePress: function (oEvent) {
			this.taskType = "Approve";
			this._handleRemarkDialog(this);
		},
		onRejectPress: function (oEvent) {
			this.taskType = "Reject";
			this._handleRemarkDialog(this);
		},
		onPostPress: function () {
			if (this._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestTypeID === "001") {
				this._handleBatchProcess(this, "Post");
			} else if (this._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestTypeID === "002") {
				this._handleBatchProcess(this, "Delete");
			}
		},
		onClosePress: function () {
			this.taskType = "Close";
			this._handleRemarkDialog(this);
		},
		onForceClose: function () {
			this.taskType = "ForceClose";
			this._handleRemarkDialog(this);
		},
		onWithdrawPress: function () {
			this.taskType = "Withdraw";
			this._handleRemarkDialog(this);
		},
		onSendEmail: function () {
			this.taskType = "SendEmail";
			this._handleRemarkDialog(this);
		},
		_validateHeader: function (oEvent) {
			var error;
			var objHeader = this._oComponent.getModel("defaultValueModel").getData().DetailHeader;
			if (objHeader.RequestTypeID === "" || objHeader.RequestTypeID === undefined) {
				error = "X";
				this.getView().byId("RequestTypeid").setValueState(sap.ui.core.ValueState.Error);
				this.getView().byId("RequestTypeid").setShowValueStateMessage(false);
			} else {
				this.getView().byId("RequestTypeid").setValueState(sap.ui.core.ValueState.None);
			}

			if (objHeader.ReasonCodeID === "" || objHeader.ReasonCodeID === undefined) {
				error = "X";
				this.getView().byId("ReasonCodeid").setValueState(sap.ui.core.ValueState.Error);
				this.getView().byId("ReasonCodeid").setShowValueStateMessage(false);
			} else {
				this.getView().byId("ReasonCodeid").setValueState(sap.ui.core.ValueState.None);
			}

			if (objHeader.PostingPlant === "" || objHeader.PostingPlant === undefined) {
				error = "X";
				this.getView().byId("PostingPlantid").setValueState(sap.ui.core.ValueState.Error);
				this.getView().byId("PostingPlantid").setShowValueStateMessage(false);
			} else {
				this.getView().byId("PostingPlantid").setValueState(sap.ui.core.ValueState.None);
			}

			if (objHeader.MfgPlant === "" || objHeader.MfgPlant === undefined) {
				error = "X";
				this.getView().byId("MfgPlantid").setValueState(sap.ui.core.ValueState.Error);
				this.getView().byId("MfgPlantid").setShowValueStateMessage(false);
			} else {
				this.getView().byId("MfgPlantid").setValueState(sap.ui.core.ValueState.None);
			}

			return error;
		},
		_validate: function (oEvent) {
			var error;
			var oTable = this.getView().byId("tMaterialList");
			var items = oTable.getItems();
			var row;
			var cell;
			error = this._validateHeader();
			for (row = 0; row < items.length; row++) {
				var item = items[row].getCells();
				for (cell = 0; cell < item.length; cell++) {
					if (item[cell].getMetadata()._sClassName === "sap.m.Input") {
						if (item[cell].getValue() === "") {
							error = "X";
							item[cell].setValueState(sap.ui.core.ValueState.Error);
							item[cell].setShowValueStateMessage(false);
						} else {
							item[cell].setValueState(sap.ui.core.ValueState.None);
						}
					} else if (item[cell].getMetadata()._sClassName === "sap.m.Select") {
						if (item[cell].getSelectedKey() === "") {
							error = "X";
							item[cell].setValueState(sap.ui.core.ValueState.Error);
						} else {
							item[cell].setValueState(sap.ui.core.ValueState.None);
						}
					}
				}
			}
			if (error === "X") {
				MessageToast.show("All fields are mandatory, \n Please fill value in the highlighted field");
			} else {
				var RequestItem = this._oComponent.getModel("defaultValueModel").getData().RequestItem;
				if (RequestItem.length === 0) {
					error = "X";
					MessageToast.show("Material list can not be blank");
				}
				var uniquePartNo = [];
				var duplicateError = "";
				var invalidNumber = "";
				for (row = 0; row < items.length; row++) {
					if (uniquePartNo.indexOf(items[row].getCells()[0].getValue()) === -1) {
						uniquePartNo = uniquePartNo.concat(items[row].getCells()[0].getValue());
					} else {
						items[row].getCells()[0].setValueState(sap.ui.core.ValueState.Error);
						items[row].getCells()[0].setValueStateText("Duplicate Part No.");
						duplicateError = "X";
						error = "X";
					}
					if (items[row].getCells()[3].getValue() <= 0) {
						items[row].getCells()[3].setValueState(sap.ui.core.ValueState.Error);
						items[row].getCells()[3].setValueStateText("Cost Roll Price can not be zero");
						invalidNumber = "X";
						error = "X";
					} else {
						items[row].getCells()[3].setValueState(sap.ui.core.ValueState.None);
						items[row].getCells()[3].setValueStateText("");
					}
				}
				if (duplicateError === "X") {
					MessageToast.show("Remove all duplicate entries");
				} else if (invalidNumber === "X") {
					MessageToast.show("Cost Roll Price can not be zero");
				}
			}
			return error;
		},
		// This is used to open the dialog for the comments for approval/rejection.
		_handleRemarkDialog: function (that) {
			that._oComponent.getModel("defaultValueModel").getData().RemarkText = "";
			that._oComponent.getModel("defaultValueModel").refresh(true);
			if (!that._remarkDialog) {
				that._remarkDialog = sap.ui.xmlfragment("CostRoll.Z_FICO_IMACIPO_CR.view.fragment.Remark", that);
				that.getView().addDependent(that._remarkDialog);
			}
			that._remarkDialog.open();
		},
		onRemarksAfterclose: function (that) {
			this._remarkDialog.destroy();
			this._remarkDialog = undefined;
		},
		handleLiveChangeRemark: function (oEvent) {
			var oTextArea = oEvent.getSource(),
				iValueLength = oTextArea.getValue().length,
				iMaxLength = oTextArea.getMaxLength(),
				sState = iValueLength > iMaxLength ? "Error" : "None";
			oTextArea.setValueState(sState);
		},
		onSubmitRemarkBox: function (oEvent) {
			if (oEvent.getSource().getParent().getParent().getContent()[0].getValueState() === "Error") {
				MessageToast.show("Maximum 50 characters permitted. Please remove the extra characters and resubmit.");
				return;
			} else if (this._oComponent.getModel("defaultValueModel").getData().RemarkText === "" && (this.taskType === "Reject" || this.taskType ===
					"ForceClose" || this.taskType === "Withdraw")) {
				MessageToast.show("Remark/Comments mandatory for Rejection.");
				return;
			} else if (this.taskType === "Create" ||
				this.taskType === "Resubmit" ||
				this.taskType === "Draft" ||
				this.taskType === "Withdraw"
			) {
				this._remarkDialog.close();
				this._handleBatchProcess(this, this.taskType);
			} else if (this.taskType === "Approve" ||
				this.taskType === "Reject" ||
				this.taskType === "Close" ||
				this.taskType === "ForceClose"
			) {
				this._remarkDialog.close();
				this._handleActionServices(this);
			} else if (this.taskType === "SendEmail") {
				this._remarkDialog.close();
				this._SendEmail();
			}
		},
		onRemarkBoxClose: function (oEvent) {
			this._remarkDialog.close();
		},
		// // This is used create the request. This is a private function.
		_handleBatchProcess: function (that, requestType) {
			BusyIndicator.show();
			var batchUrls = [];
			var url = "/sap/opu/odata/sap/ZOD_FICO_IMACIPO_CR_SRV/";
			var oModel = new sap.ui.model.odata.ODataModel(url, true);
			var oData = that._oComponent.getModel("defaultValueModel").getData();
			var header = {},
				refHeader = {};
			refHeader = oData.DetailHeader;
			delete refHeader.ReasonCodeList;
			if (requestType.toUpperCase() === "CREATE" || requestType.toUpperCase() === "DRAFT" || requestType.toUpperCase() === "VALIDATE") {
				header.Action = requestType.toUpperCase();
				header.RequestNumber = refHeader.RequestNumber;
				header.RequestTypeID = refHeader.RequestTypeID;
				header.RequestTypeDesc = refHeader.ReqTypeDescript;
				header.ReasonCodeID = refHeader.ReasonCodeID;
				header.ReasonCodeDesc = refHeader.ReasonCodeDesc;
				header.MfgPlant = refHeader.MfgPlant;
				header.PostingPlant = refHeader.PostingPlant;
				header.CostingDate = refHeader.CostingDate;
				header.Status = refHeader.Status;
				header.Remarks = oData.RemarkText;
				header.CreatedOn = new Date();
				header.Initiator = that._oComponent.getModel("fieldHandlingModel").getData().UserDetails.Username;
				header.ChgUserName = refHeader.ChgUserName;
				header.ChangeDate = refHeader.ChangeDate;
				header.RequestTypeDesc = refHeader.RequestTypeDesc;
			} else if (requestType.toUpperCase() === "POST" ||
				requestType.toUpperCase() === "DELETE" ||
				requestType.toUpperCase() === "RESUBMIT" ||
				requestType.toUpperCase() === "WITHDRAW"
			) {
				header = refHeader;
				header.Action = requestType.toUpperCase();
				header.Remarks = oData.RemarkText;
			}
			if (this._oComponent.getModel("defaultValueModel").getData().AttachmentList.length === 0) {
				header.Attachment = "";
			} else {
				header.Attachment = "X";
			}
			if (requestType.toUpperCase() === "WITHDRAW") {
				header.Status = "007";
			}
			oData.RequestItem.forEach(function (RequestItem) {
				RequestItem.SequenceNumber = RequestItem.SequenceNumber.toString();
			});
			if ((requestType.toUpperCase() === "RESUBMIT" || requestType.toUpperCase() === "DRAFT") && (oData.refRequestItem.length !== 0)) {
				oData.refRequestItem.forEach(function (refRequestItem) {
					var notFoundArray = oData.RequestItem.filter(function (RequestItem) {
						return RequestItem.SequenceNumber === refRequestItem.SequenceNumber;
					});
					if (notFoundArray.length === 0) {
						refRequestItem.DeletionIndicator = "X";
						refRequestItem.SequenceNumber = refRequestItem.SequenceNumber.toString();
						oData.RequestItem = oData.RequestItem.concat(refRequestItem);
					}
				});
			}
			batchUrls.push(oModel.createBatchOperation("/RequestHeaderSet", "POST", header));
			oData.RequestItem.forEach(function (RequestItem) {
				if (RequestItem.OldNew === "NEW") {
					RequestItem.MFGSiteIRPrice = "0";
					RequestItem.MFGIRPricePer = "0";
					RequestItem.ExistingMfgSiteStdCost = "0";
					RequestItem.ExistingMfgSiteStdCostPer = "0";
					RequestItem.ExistingSG03SG05StdCost = "0";
					RequestItem.ExistingSG03SG05StdCostPer = "0";
					RequestItem.ExistingSG03SG05PlannedPrice = "0";
					RequestItem.FuturePrice = "0";
					RequestItem.FuturePriceDate = new Date();
				}
				if (!RequestItem.ValidationError || requestType.toUpperCase() === "DRAFT") {
					RequestItem.ValidationError = "";
				} else {
					RequestItem.ValidationError = JSON.stringify(RequestItem.ValidationError);
				}
				delete RequestItem.changed;
				delete RequestItem.Action;
				delete RequestItem.__metadata;
				delete RequestItem.FuturePriceNew;
				delete RequestItem.FuturePriceDateNew;
				delete RequestItem.error;
				delete RequestItem.Status;
				delete RequestItem.UserDetails;
				delete RequestItem.Initiator;
				batchUrls.push(oModel.createBatchOperation("/RequestItemSet", "POST", RequestItem));

			});

			oModel.addBatchChangeOperations(batchUrls);
			oModel.setUseBatch(true);
			oModel.submitBatch(function (oData, oResponse) {
				if (oData.__batchResponses[0].response) {
					MessageToast.show(JSON.parse(oData.__batchResponses[0].response.body).error.message.value);
					BusyIndicator.hide();

				} else {
					var changeResponse = oData.__batchResponses[0].__changeResponses;
					var obj = that._oComponent.getModel("defaultValueModel").getData();
					var objButton = that._oComponent.getModel("fieldHandlingModel").getData();
					var newRow = [];
					var detailHeader = {};
					var errorCount = 0;
					obj.RequestItem = [];
					changeResponse.forEach(function (Response) {
						if (Response.data.__metadata.type === "ZOD_FICO_IMACIPO_CR_SRV.RequestItem") {
							Response.data.SequenceNumber = Number(Response.data.SequenceNumber);
							if (Response.data.DeletionIndicator === "") {
								if (Response.data.ValidationError !== "") {
									Response.data.ValidationError = JSON.parse(Response.data.ValidationError);
									errorCount = errorCount + Response.data.ValidationError.length;
									objButton.displayNotes = true;
								}
								Response.data.QA = parseInt(Response.data.QA).toString();
								Response.data.Status = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.Status;
								Response.data.UserDetails = that._oComponent.getModel("fieldHandlingModel").getData().UserDetails;
								newRow.push(Response.data);
							}

						} else if (Response.data.__metadata.type === "ZOD_FICO_IMACIPO_CR_SRV.RequestHeader") {
							detailHeader = Response.data;
						}
					});
					obj.DetailHeader = detailHeader;
					obj.RequestItem = obj.RequestItem.concat(newRow);
					obj.RequestItem.forEach(function (item) {
						item.Initiator = detailHeader.Initiator;
					});
					that._oComponent.getModel("defaultValueModel").setData(obj);
					that._oComponent.getModel("defaultValueModel").refresh(true);
					that._oComponent.getModel("fieldHandlingModel").setData(objButton);
					that._oComponent.getModel("fieldHandlingModel").refresh(true);
					if (obj.DetailHeader.Action === "CREATE" || obj.DetailHeader.Action === "RESUBMIT") {
						if (errorCount === 0) {
							that._handleCreateRequestAttachmentUpload(that);
							that.handleClose();
						} else {
							MessageToast.show("Please fix all errors mentioned in the validation notes");
						}
					} else if (obj.DetailHeader.Action === "DRAFT") {
						that._handleCreateRequestAttachmentUpload(that);
						that.handleClose();
					} else if (obj.DetailHeader.Action === "POST") {
						that._refreshLog(obj.DetailHeader.RequestNumber);
						var objButton = that._oComponent.getModel("fieldHandlingModel").getData();
						if (errorCount === 0) {
							objButton.displayNotes = false;
						} else {
							objButton.displayNotes = true;
						}
						that._oComponent.getModel("fieldHandlingModel").refresh(true);
						that._handleFinanceButtons(obj.RequestItem, that, false);
					} else if (obj.DetailHeader.Action === "DELETE") {
						that._handleBatchProcess(that, "Post");
					} else if (obj.DetailHeader.Action === "WITHDRAW") {
						var msgText = "Request " + obj.DetailHeader.RequestNumber + " Withdraw Successfully";
						MessageBox.success(msgText, {
							actions: [MessageBox.Action.OK, ],
							emphasizedAction: MessageBox.Action.OK,
							onClose: function (sAction) {
								BusyIndicator.show();
								that.handleClose();
							}
						});
					} else if (obj.DetailHeader.Action === "VALIDATE") {

						if (errorCount === 0) {
							MessageToast.show("No errors found");
						} else {
							MessageToast.show("Please fix all errors mentioned in the validation notes");
						}
						var obj = that._oComponent.getModel("defaultValueModel").getData();
						var objButton = that._oComponent.getModel("fieldHandlingModel").getData();
						if (obj.DetailHeader.RequestNumber !== "") {
							if (errorCount === 0) {
								objButton.Submit = true;
							} else {
								objButton.Submit = false;
							}
						}
						that._oComponent.getModel("fieldHandlingModel").setData(objButton);
						that._oComponent.getModel("fieldHandlingModel").refresh(true);
					}
				}
				BusyIndicator.hide();
			}, function (error) {
				BusyIndicator.hide();
			});

		},
		readSingleItem: function (item, itemNo) {
			var header = {},
				refHeader = {},
				eItem = {};
			refHeader = this._oComponent.getModel("defaultValueModel").getData().DetailHeader;
			header.Action = "VALIDATE";
			header.RequestTypeID = refHeader.RequestTypeID;
			header.RequestTypeDesc = refHeader.ReqTypeDescript;
			header.ReasonCodeID = refHeader.ReasonCodeID;
			header.ReasonCodeDesc = refHeader.ReasonCodeDesc;
			header.MfgPlant = refHeader.MfgPlant;
			header.PostingPlant = refHeader.PostingPlant;
			header.CostingDate = refHeader.CostingDate;
			header.Status = refHeader.Status;
			header.Initiator = this._oComponent.getModel("fieldHandlingModel").getData().UserDetails.Username;
			if (this._oComponent.getModel("defaultValueModel").getData().AttachmentList.length === 0) {
				header.Attachment = "";
			} else {
				header.Attachment = "X";
			}
			item.MFGSiteIRPrice = "0";
			item.MFGIRPricePer = "0";
			item.ExistingMfgSiteStdCost = "0";
			item.ExistingMfgSiteStdCostPer = "0";
			item.ExistingSG03SG05StdCost = "0";
			item.ExistingSG03SG05StdCostPer = "0";
			item.ExistingSG03SG05PlannedPrice = "0";
			item.FuturePrice = "0";
			item.FuturePriceDate = new Date();
			item.ValidationError = "";
			item.SequenceNumber = item.SequenceNumber.toString()
			delete item.changed;
			delete item.OldNew;
			delete item.Status;
			delete item.UserDetails;
			delete item.Initiator;

			delete item.Action;
			delete item.__metadata;
			delete item.FuturePriceNew;
			delete item.FuturePriceDateNew;
			delete item.error;

			var HeaderToItem = [];
			HeaderToItem.push(item);

			var oEntry = {};
			var that = this;
			oEntry = header;
			oEntry.HeaderToItem = HeaderToItem;
			that._oComponent.getModel("oDataModelNGD").create("/RequestHeaderSet", oEntry, {
				success: function (data) {
					var objButton = that._oComponent.getModel("fieldHandlingModel").getData();
					eItem = data.HeaderToItem.results[0];
					eItem.SequenceNumber = Number(eItem.SequenceNumber);
					eItem.QA = parseInt(eItem.QA).toString();
					if (eItem.ValidationError !== "") {
						eItem.ValidationError = JSON.parse(eItem.ValidationError);
						objButton.displayNotes = true;
					}
					var obj = that._oComponent.getModel("defaultValueModel").getData();
					obj.RequestItem[itemNo] = eItem;
					obj.RequestItem[itemNo].Status = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.Status;
					obj.RequestItem[itemNo].UserDetails = that._oComponent.getModel("fieldHandlingModel").getData().UserDetails;
					obj.RequestItem[itemNo].Initiator = data.Initiator;
					that._oComponent.getModel("defaultValueModel").setData(obj);
					that._oComponent.getModel("defaultValueModel").refresh(true);
					that._oComponent.getModel("fieldHandlingModel").setData(objButton);
					that._oComponent.getModel("fieldHandlingModel").refresh(true);
					BusyIndicator.hide();

				},
				error: function (error) {
					BusyIndicator.hide();
				}
			});
		},
		onInputChange: function (oEvent) {
			oEvent.getSource().getBindingContext("defaultValueModel").getObject().changed = true;
		},
		onPriceInputChange: function (oEvent) {
			oEvent.getSource().getBindingContext("defaultValueModel").getObject().changed = true;
			var CostRollPrice = oEvent.getSource().getBindingContext("defaultValueModel").getObject().CostRollPrice;
			oEvent.getSource().getBindingContext("defaultValueModel").getObject().CostRollPrice = this._formatNumberPrice(CostRollPrice);
		},
		onQAInput: function (oEvent) {
			oEvent.getSource().getBindingContext("defaultValueModel").getObject().changed = true;
			var QA = oEvent.getSource().getBindingContext("defaultValueModel").getObject().QA;
			oEvent.getSource().getBindingContext("defaultValueModel").getObject().QA = this._formatNumberQA(QA);
		},
		// This is triggered when user tries to upload an attachment from the UI.
		onUploadTrigger: function (oEvent) {
			if (oEvent.getParameter('files')[0].size > 3145728) {
				MessageToast.show("Maximum permitted file size is 3 MB.");
				return;
			}
			if (this._oComponent.getModel("fieldHandlingModel").getData().DontUpload === false) {
				BusyIndicator.show();
				if (this._oComponent.getModel("fieldHandlingModel").getData().createRequest === true) {
					var typeOfFile = oEvent.getParameter("files")[0].type,
						obj = {};
					obj.FileName = oEvent.getParameter('files')[0].name;
					if (typeOfFile === "application/msword") {
						obj.MIMEType = "sap-icon://doc-attachment";
					} else if (typeOfFile === "image/jpeg" || typeOfFile === "image/png" || typeOfFile === "image/jpg" || typeOfFile === "image/gif") {
						obj.MIMEType = "sap-icon://picture";
					} else if (typeOfFile === "application/vnd.ms-excel" || typeOfFile ===
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
						obj.MIMEType = "sap-icon://excel-attachment";
					} else if (typeOfFile === "text/plain") {
						obj.MIMEType = "sap-icon://attachment-text-file";
					} else if (typeOfFile === "application/pdf") {
						obj.MIMEType = "sap-icon://pdf-attachment";
					} else {
						obj.MIMEType = "sap-icon://email";
					}
					obj.data = oEvent.getParameter('files')[0];
					var refObj = this._oComponent.getModel("defaultValueModel").getData(),
						arr = refObj.AttachmentList;
					arr.push(obj);
					refObj.AttachmentList = arr;
					refObj.AttahmentUploadCounter = 10 - arr.length;
					if (arr.length >= 10) {
						refObj.AttahmentUploadVisibility = false;
						refObj.AttachmentMaxOutText = true;
					} else {
						refObj.AttahmentUploadVisibility = true;
						refObj.AttachmentMaxOutText = false;
					}
					obj.GUID = new Date();
					this._oComponent.getModel("defaultValueModel").getData().RequestItem.forEach(function (item) {
						item.changed = true;
					});
					this._oComponent.getModel("defaultValueModel").setData(refObj);
					this._oComponent.getModel("defaultValueModel").refresh(true);
					BusyIndicator.hide();
					oEvent.getSource().clear();
				} else {
					this._updateAttachmentToServer("", oEvent.getParameter('files')[0], this, oEvent.getParameter('files')[0].name, oEvent.getParameter(
						'files')[0].name.split('.')[oEvent.getParameter('files')[0].name.split('.').length - 1], oEvent.getSource());
				}
			}
			this._oComponent.getModel("fieldHandlingModel").getData().DontUpload = false;
			this._oComponent.getModel("fieldHandlingModel").refresh(true);
		},
		_handleFileNameAndType: function (file) {
			var a = file.name.split('.');
			var type = file.name.split('.')[a.length - 1];
			switch (type) {
			case '':
				// xlsx
				break;
			case '':
				// code block
				break;
			default:
				// code block
			}
		},
		// This is a private function to hangle the odata call to upload attachment from the UI to the backend system.
		_updateAttachmentToServer: function (header, file, that, filename, filetype, controlRef) {
			var oModel = this._oComponent.getModel('oDataModelNGD');
			var oCustomerHeaderTokenfetch = new sap.m.UploadCollectionParameter({
				name: "x-csrf-token",
				value: oModel.getSecurityToken()
			});
			this.token = oCustomerHeaderTokenfetch.mProperties.value;
			this.slug = this._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber + '|' + filename + '|' + filetype.toUpperCase();
			header = {
				"x-csrf-token": this.token,
				"slug": this.slug
			};
			var that = this;
			jQuery.ajax({
				type: 'POST',
				url: "/sap/opu/odata/sap/ZOD_FICO_IMACIPO_CR_SRV/AttachFileSet",
				headers: header,
				cache: false,
				contentType: false,
				processData: false,
				data: file,
				async: true,
				success: function (oEvent) {
					var oFilters = [],
						requestNumber = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber
					if (requestNumber) {
						var filter = new Filter("RequestNumber", "EQ", requestNumber);
						oFilters.push(filter);
					}
					that._fetchAttachmentDetails(that, oFilters);
					that._refreshLog(requestNumber);
					controlRef.clear();
				},
				error: function (err) {
					BusyIndicator.hide();
					MessageToast.show("Attachment upload failed.");
					controlRef.clear();
				}
			});

		},
		// This event is triggered when the user wants to delete an attachment.
		onFileDeletePress: function (oEvent) {
			var deleteItemSelected = oEvent.getParameter("documentId"),
				obj = {};
			if (this._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber !== '') {
				this._oComponent.getModel("defaultValueModel").getData().AttachmentList.forEach(async function (AttachmentItem) {
					if (AttachmentItem.GUID == deleteItemSelected) {
						obj = AttachmentItem;
						return;
					}
				})
				if (obj.url !== undefined) {
					var that = this;

					var path = this._oComponent.getModel('oDataModelNGD').createKey("/AttachFileSet", {
						RequestNumber: obj.RequestNumber,
						GUID: obj.GUID,
						ReferenceFileType: obj.MIMEType,
						FileName: obj.FileName
					});
					that._oComponent.getModel('oDataModelNGD').remove(path, {
						success: function (data) {
							var oFilters = [],
								requestNumber = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber;
							if (requestNumber) {
								var filter = new Filter("RequestNumber", "EQ", requestNumber);
								oFilters.push(filter);
							}
							that._fetchAttachmentDetails(that, oFilters);
							that._refreshLog(requestNumber);
						},
						error: function (error) {

							BusyIndicator.hide();
							if (!error.headers.server) {
								var ref = JSON.parse(error.responseText).error;
								if (!ref.innererror.errordetails[0].message) {
									MessageToast.show(ref.message.value);
								} else {
									MessageToast.show(ref.innererror.errordetails[0].message);
								}
							} else {
								var oParser = new DOMParser();
								var oDOM = oParser.parseFromString(error.responseText, "application/xml");
								MessageToast.show(oDOM.documentElement.textContent);
							}

						}
					});
				} else {
					var that = this;
					this._oComponent.getModel("defaultValueModel").getData().AttachmentList.forEach(async function (AttachmentItem, index) {
						if (AttachmentItem.GUID == deleteItemSelected) {
							that._oComponent.getModel("defaultValueModel").getData().AttachmentList.splice(index, 1);
							that._oComponent.getModel("defaultValueModel").getData().AttahmentUploadVisibility = true;
							that._oComponent.getModel("defaultValueModel").getData().AttachmentMaxOutText = false;
							that._oComponent.getModel("defaultValueModel").getData().AttahmentUploadCounter = 10 - that._oComponent.getModel(
								"defaultValueModel").getData().AttachmentList.length;
							that._oComponent.getModel("defaultValueModel").refresh(true);
							return;
						}
					})

				}
			} else {
				var that = this;
				this._oComponent.getModel("defaultValueModel").getData().AttachmentList.forEach(async function (AttachmentItem, index) {
					if (AttachmentItem.GUID == deleteItemSelected) {
						that._oComponent.getModel("defaultValueModel").getData().AttachmentList.splice(index, 1);
						that._oComponent.getModel("defaultValueModel").getData().AttahmentUploadVisibility = true;
						that._oComponent.getModel("defaultValueModel").getData().AttachmentMaxOutText = false;
						that._oComponent.getModel("defaultValueModel").getData().AttahmentUploadCounter = 10 - that._oComponent.getModel(
							"defaultValueModel").getData().AttachmentList.length;
						that._oComponent.getModel("defaultValueModel").refresh(true);
						return;
					}
				})
			}
			this._oComponent.getModel("defaultValueModel").getData().RequestItem.forEach(function (item) {
				item.changed = true;
			});
			this._oComponent.getModel("defaultValueModel").refresh(true);
		},
		// This is aprovate function used to fecth the list of attachments from the backend for the selected request.
		_fetchAttachmentDetails: function (that, oFilters) {
			var a = that;
			that._oComponent.getModel('oDataModelNGD').read("/AttachFileSet", {
				filters: oFilters,
				success: function (data) {
					var obj = a._oComponent.getModel("defaultValueModel").getData();

					obj.AttachmentList = data.results;
					obj.AttahmentUploadCounter = 10 - data.results.length;
					if (data.results.length >= 10) {
						obj.AttahmentUploadVisibility = false;
						obj.AttachmentMaxOutText = true;
					} else {
						obj.AttahmentUploadVisibility = true;
						obj.AttachmentMaxOutText = false;
					}
					var isQueueOwner = a._checkQueueOwner(a, oFilters[0].oValue1);
					var path;
					obj.AttachmentList.forEach(async function (AttachmentItem) {
						path = a._oComponent.getModel('oDataModelNGD').createKey("/AttachFileSet", {
							RequestNumber: AttachmentItem.RequestNumber,
							GUID: AttachmentItem.GUID,
							ReferenceFileType: AttachmentItem.MIMEType,
							FileName: AttachmentItem.FileName
						});
						AttachmentItem.url = "/sap/opu/odata/sap/ZOD_FICO_IMACIPO_CR_SRV" + path + "/$value";
						// AttachmentItem.url = "/sap/opu/odata/sap/ZOD_FICO_IMACIPO_CR_SRV/AttachFileSet(RequestNumber='" + AttachmentItem.RequestNumber +
						// 	"',GUID='" + AttachmentItem.GUID + "',ReferenceFileType='" + AttachmentItem.MIMEType + "',FileName='" +
						// 	encodeURIComponent(AttachmentItem.FileName.replace(/[!'()*]/g,(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)) + "')/$value";
						if (isQueueOwner === true && obj.DetailHeader.Status !== "005" && obj.DetailHeader.Status !== "006" && obj.DetailHeader.Status !==
							"007") {
							AttachmentItem.visibleAttachmentDelete = true;
						} else {
							AttachmentItem.visibleAttachmentDelete = false;
						}
					})
					obj.AttahmentUploadCounter = 10 - data.results.length;
					a._oComponent.getModel("defaultValueModel").refresh(true);
					BusyIndicator.hide();
				},
				error: function (error) {
					BusyIndicator.hide();
				}
			});
		},
		// This is a private function, triggered for adding attachment to the request.
		_handleCreateRequestAttachmentUpload: function (that) {
			if (that._oComponent.getModel("defaultValueModel").getData().AttachmentList.length > 0) {
				var AttachmentList = that._oComponent.getModel("defaultValueModel").getData().AttachmentList;
				for (var i = 0; i < AttachmentList.length; i++) {
					if (!AttachmentList[i].url) {
						var async_function = async function () {
							await that._updateAttachmentToServerAfterCreate(AttachmentList[i].data, that, AttachmentList[i].FileName, AttachmentList[i].FileName
								.split('.')[AttachmentList[i].FileName.split('.').length - 1]);
						}
						async_function();
					}
				}
			}
			var msgText = "";
			var oAction = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.Action;
			if (oAction === "CREATE") {
				msgText = "Successfully created ";
			} else if (oAction === "RESUBMIT") {
				msgText = "Successfully submitted for approval ";
			} else if (oAction === "DRAFT") {
				msgText = "Successfully saved ";
			}
			if (that.errorAttachment === 0 && that.successAttachment === 0) {
				MessageBox.success(msgText + that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber, {
					actions: [MessageBox.Action.OK, ],
					emphasizedAction: MessageBox.Action.OK,
					onClose: function (sAction) {
						BusyIndicator.show();
						that.handleClose();
					}
				});
			} else {
				MessageBox.success(msgText + that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber +
					"\n Successful attachments = " + that.successAttachment + "\n Failed attachments = " + that.errorAttachment, {
						actions: [MessageBox.Action.OK, ],
						emphasizedAction: MessageBox.Action.OK,
						onClose: function (sAction) {
							BusyIndicator.show();
							that.handleClose();
						}
					});
			}
			BusyIndicator.hide();
		},
		// This is triggered when the size limit is exceeded for the attachment.
		onfileSizeExceed: function () {
			var fieldHandling = this._oComponent.getModel("fieldHandlingModel").getData();
			fieldHandling.DontUpload = true;
			this._oComponent.getModel("fieldHandlingModel").refresh(true);
			MessageToast.show("Maximum permitted file size is 3 MB.");
		},
		// This is a private function, triggered for attchment upload after the request is created.
		_updateAttachmentToServerAfterCreate: async function (file, that, filename, filetype) {
			return new Promise(function (resolve) {
				var oModel = that._oComponent.getModel('oDataModelNGD');
				var oCustomerHeaderTokenfetch = new sap.m.UploadCollectionParameter({
					name: "x-csrf-token",
					value: oModel.getSecurityToken()
				});
				that.token = oCustomerHeaderTokenfetch.mProperties.value;
				that.slug = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber + '|' + filename + '|' +
					filetype.toUpperCase();
				var header = {
					"x-csrf-token": that.token,
					"slug": that.slug
				};
				var a = that;
				jQuery.ajax({
					type: 'POST',
					url: "/sap/opu/odata/sap/ZOD_FICO_IMACIPO_CR_SRV/AttachFileSet",
					headers: header,
					cache: false,
					contentType: false,
					processData: false,
					data: file,
					async: false,
					success: function (oEvent) {
						resolve();
						a.successAttachment = a.successAttachment + 1;
					},
					error: function (err) {
						a.errorAttachment = a.errorAttachment + 1;
						// BusyIndicator.hide();
					}
				});
			})
		},
		onTypeMissmatch: function () {
			MessageToast.show("Selected file type is not supported. Supported types: pdf,doc,xls,msg. ");

		},
		createColumnConfigExcel: function () {
			var i18n = this.getView().getModel("i18n").getResourceBundle();
			var EdmType = exportLibrary.EdmType;
			var postingPlant = this._oComponent.getModel("defaultValueModel").getData().DetailHeader.PostingPlant;
			return [{
					label: i18n.getText("PartNo"),
					property: 'PartNo',
					type: EdmType.String,
					width: '30'
				}, {
					label: i18n.getText("SupplierCode"),
					property: 'SupplierName',
					type: EdmType.String,
					width: '30'
				}, {
					label: i18n.getText("SupplierNameText"),
					property: 'SupplierNameText',
					type: EdmType.String,
					width: '60'
				}, {
					label: i18n.getText("MPN"),
					property: 'MPN',
					type: EdmType.String,
					width: '20'
				}, {
					label: i18n.getText("CostRollPrice2"),
					property: 'CostRollPrice',
					type: EdmType.Number,
					width: '10'
				}, {
					label: i18n.getText("Source2"),
					property: 'Source',
					type: EdmType.String,
					width: '30'
				}, {
					label: i18n.getText("QA"),
					property: 'QA',
					type: EdmType.Number,
					width: '10'
				}, {
					label: i18n.getText("CommonPart") + " " + postingPlant,
					property: 'CommonPart',
					type: EdmType.String,
					width: '5'
				}, {
					label: i18n.getText("ProfitCenter"),
					property: 'SGProfitCenter',
					type: EdmType.String,
					width: '5'
				}, {
					label: i18n.getText("MFGSiteIRPrice"),
					property: 'MFGSiteIRPrice',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("MFGIRPricePer"),
					property: 'MFGIRPricePer',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("ExistingMfgSiteStdCost"),
					property: 'ExistingMfgSiteStdCost',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("ExistingMfgSiteStdCostPer"),
					property: 'ExistingMfgSiteStdCostPer',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("ExistingSG03SG05StdCost"),
					property: 'ExistingSG03SG05StdCost',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("ExistingSG03SG05StdCostPer"),
					property: 'ExistingSG03SG05StdCostPer',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("ExistingSG03SG05PlannedPrice"),
					property: 'ExistingSG03SG05PlannedPrice',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("FuturePrice"),
					property: 'FuturePrice',
					type: EdmType.Number,
					width: '5'
				}, {
					label: i18n.getText("FuturePriceDate"),
					property: 'FuturePriceDate',
					type: EdmType.String,
					width: '5'
				}, {
					label: i18n.getText("ValidateNotes"),
					property: 'ValidateNotes',
					type: EdmType.String,
					width: '100'
				}

			];
		},

		onDownloadExcel: function () {
			var RequestItem = this._oComponent.getModel("defaultValueModel").getData().RequestItem;
			if (RequestItem.length !== 0) {
				var aCols, aData, oSettings, oSheet;
				aCols = this.createColumnConfigExcel();
				aData = [];
				RequestItem.forEach(function (item) {
					var validateNotes = "";
					var futurePriceDate = "";
					if (item.FuturePriceDate !== null && item.FuturePriceDate !== "") {
						futurePriceDate = item.FuturePriceDate.toLocaleDateString();
					}
					if (item.ValidationError !== undefined && item.ValidationError !== "" && item.ValidationError !== null) {
						item.ValidationError.forEach(function (error) {
							validateNotes = validateNotes + error.fieldname + ":" + error.message + ";";
						});
					}
					aData.push({
						SequenceNumber: item.SequenceNumber,
						PartNo: item.PartNo,
						SupplierName: item.SupplierName,
						SupplierNameText: item.SupplierNameText,
						MPN: item.MPN,
						CostRollPrice: item.CostRollPrice,
						Source: item.Source,
						QA: item.QA,
						CommonPart: item.CommonPart,
						SGProfitCenter: item.SGProfitCenter,
						MFGSiteIRPrice: item.MFGSiteIRPrice,
						MFGIRPricePer: item.MFGIRPricePer,
						ExistingMfgSiteStdCost: item.ExistingMfgSiteStdCost,
						ExistingMfgSiteStdCostPer: item.ExistingMfgSiteStdCostPer,
						ExistingSG03SG05StdCost: item.ExistingSG03SG05StdCost,
						ExistingSG03SG05StdCostPer: item.ExistingSG03SG05StdCostPer,
						ExistingSG03SG05PlannedPrice: item.ExistingSG03SG05PlannedPrice,
						FuturePrice: item.FuturePrice,
						FuturePriceDate: futurePriceDate,
						ValidateNotes: validateNotes
					});
				});
				aData.sort((a, b) => a.SequenceNumber - b.SequenceNumber);
				oSettings = {
					workbook: {
						columns: aCols
					},
					dataSource: aData,
					fileName: 'Material List.xlsx'
				};

				oSheet = new Spreadsheet(oSettings);
				oSheet.build()
					.then(function () {

					})
					.finally(oSheet.destroy);
			} else {
				MessageToast.show("No data available to download");
			}
		},
		// This is a private function used for action task.
		_handleActionServices: function (that) {
			BusyIndicator.show();
			var requestNumber = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber;
			var myInboxRecords = that._oComponent.getModel("tableEntriesModel").oData.MyInboxSet;
			var WorkItemId = myInboxRecords.filter(function (value) {
				return value.RequestNumber === requestNumber;
			}).map(function (value) {
				return value.WiId;
			})[0];

			that._oComponent.getModel("defaultValueModel").getData().WorkItemId = WorkItemId;
			var decisionKey;
			switch (that.taskType) {
			case 'Approve':
				decisionKey = '0001';
				break;
			case 'Reject':
				decisionKey = '0002';
				break;
			case 'Close':
				decisionKey = '0003';
				break;
			case 'ForceClose':
				decisionKey = '0004';
				break;
			}

			that._oComponent.getModel('actionModelNGD').callFunction("/ApplyDecision", {
				method: "POST",
				urlParameters: {
					workitem_id: WorkItemId,
					dec_key: decisionKey,
					comments: that._oComponent.getModel("defaultValueModel").getData().RemarkText
				},
				success: function (data) {
					that.handleClose();
					BusyIndicator.hide();
				},
				error: function (error) {

					BusyIndicator.hide();
					var errorText = JSON.parse(error.responseText);
					errorText = errorText.error.message.value;
					MessageToast.show(errorText);
				}
			});

		},
		_handleFinanceButtons: function (RequestItem, that) {
			var objButton = that._oComponent.getModel("fieldHandlingModel").getData();
			var error = false,
				success = false,
				noPosting = false,
				Posting = false,
				NoApproverErr = false,
				ApproverErr = false;
			objButton.PostingStatus = true;
			objButton.SendEmail = true;
			RequestItem.forEach(function (Item) {
				if (Item.ValidationError) {
					var ErrorExists = Item.ValidationError.find((ValidationError) => {
						if (ValidationError.type === "Error") {
							return true;
						}
					});
				}

				if (Item.Posting === "S") {
					success = true;
				} else if (Item.Posting === "E") {
					error = true;
				} else if (Item.Posting === "" && ErrorExists === undefined) {
					noPosting = true;
				}
				if (Item.Posting === "S" || Item.Posting === "E") {
					Posting = true;
				}
				if (Item.ApproverErr === "") {
					NoApproverErr = true;
				}
				if (Item.ApproverErr !== "" && ErrorExists !== undefined) {
					ApproverErr = true;
				}
			});

			objButton.Post = false;
			objButton.Close = false;
			objButton.ForceClose = false;
			objButton.Rejecter = false

			if (noPosting === true || error === true) {
				objButton.Post = true;
			}
			if ((error === true || ApproverErr === true) && Posting === true) {
				objButton.ForceClose = true;
			}
			if (success === true && error === false && ApproverErr === false) {
				objButton.Close = true;
				objButton.SendEmail = false;
			}
			if (Posting === false) {
				objButton.Rejecter = true;
			}

			that._oComponent.getModel("fieldHandlingModel").setData(objButton);
			that._oComponent.getModel("fieldHandlingModel").refresh(true);
		},
		_setInitalDetailsScreen: function () {
			this._initRequest();
			if (window.location.href.match(/\/detail\/(\d+)/) !== null) {
				var oUserDetails = this._oComponent.getModel("fieldHandlingModel").getData().UserDetails;
				var requestNumber = window.location.href.match(/\/detail\/(\d+)/)[1];
				if (!oUserDetails) {
					this._handleViewDetailLoad(requestNumber, this);
				} else {
					var that = this;
					BusyIndicator.show();
					that._oComponent.getModel("oDataModelNGD").read("/MyInboxSet", {
						success: function (data) {
							that._oComponent.getModel("tableEntriesModel").setData({
								MyInboxSet: data.results,
								MyInboxSetLength: data.results.length
							});
							that._oComponent.getModel("tableEntriesModel").setSizeLimit(200000);
							that._oComponent.getModel("tableEntriesModel").refresh(true);
							BusyIndicator.hide();
							that._handleViewDetailLoad(requestNumber, that);
						},
						error: function (error) {
							BusyIndicator.hide();
						}
					});
				}
			}
		},
		_setHandleSubmit: function (that) {
			that._handleOnDetailLoad(that, "New");
		},
		_initRequest: function () {
			this.errorAttachment = 0;
			this.successAttachment = 0;
			this._oComponent.getModel("fieldHandlingModel").getData().DetailViewRef = this.getView();
			this._oComponent.getModel("defaultValueModel").getData().refIdocDataItems = "";
			this._oComponent.getModel("defaultValueModel").getData().RemarkText = "";
			this._oComponent.getModel("defaultValueModel").refresh(true);
			// BusyIndicator.show();
			if (this._oComponent.getModel("fieldHandlingModel").getData().RefreshScreen === false) {
				BusyIndicator.hide();
				return;
			}

			var obj = this._oComponent.getModel("fieldHandlingModel").getData();
			obj.createRequest = false;
			obj.createRequestBut = false;
			obj.creatorRejectedRequest = false;
			obj.Approver = false;
			obj.Rejecter = false;
			obj.Post = false;
			obj.Close = false;
			obj.ForceClose = false;
			obj.Withdraw = false;
			obj.finalApprover = false;
			obj.Approver = false;
			obj.Withdraw = false;
			obj.finalApprover = false;
			obj.closedRequest = false;
			obj.ShowStatus = false;
			obj.Submit = false;
			obj.Withdraw = false;
			obj.Draft = false;
			obj.SendEmail = false;
			obj.displayNotes = false;
			obj.PostingStatus = false;
			obj.refRequestItem = [];
			this._oComponent.getModel("fieldHandlingModel").refresh(true);
		},
		_SendEmail: function () {
			var that = this;
			BusyIndicator.show();
			var oEntry = {};
			var RequestNumber = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber;
			oEntry.RequestNumber = that._oComponent.getModel("defaultValueModel").getData().DetailHeader.RequestNumber;
			oEntry.Remarks = that._oComponent.getModel("defaultValueModel").getData().RemarkText;
			that._oComponent.getModel("oDataModelNGD").create("/EmailSet", oEntry, {
				success: function (data) {
					if (data.MessageType === "S") {
						MessageBox.success(data.Message);
						that._refreshLog(RequestNumber);
					} else if (data.MessageType === "E") {
						MessageBox.error(data.Message);
					}
					BusyIndicator.hide();
				},
				error: function (error) {
					BusyIndicator.hide();
				}
			});
		},
		_refreshLog: function (RequestNumber) {
			var that = this;
			BusyIndicator.show();
			this._oComponent.getModel('oDataModelNGD').read("/ZFICO_C_COSTROLL('" + RequestNumber + "')/Set", {
				urlParameters: {
					"$expand": "to_log,to_CaseCon"
				},
				method: "GET",
				success: function (data) {
					var obj = that._oComponent.getModel("defaultValueModel").getData();
					obj.AuditDataItems = data.results[0].to_log.results;
					obj.CaseContentItems = data.results[0].to_CaseCon.results;
					that._oComponent.getModel("defaultValueModel").setData(obj);
					that._oComponent.getModel("defaultValueModel").refresh(true);
					BusyIndicator.hide();
				},
				error: function (error) {
					BusyIndicator.hide();
				}

			});
		},
		_checkLengthQA: function (oEvent) {
			if (oEvent.getSource().getValue() > 100) {
				oEvent.getSource().setValue(100);
			} else if (oEvent.getSource().getValue() < 0) {
				oEvent.getSource().setValue(0);
			}

		},
		_checkLengthCostRollPrice: function (oEvent) {
			if (oEvent.getSource().getValue().length > 8 || oEvent.getSource().getValue() < 0) {
				// oEvent.getSource().setValue(oEvent.getSource().getValue().slice(0, -1));
				oEvent.getSource().setValueState(sap.ui.core.ValueState.Error);
				oEvent.getSource().setValueStateText("Invalid Number");
			} else {
				oEvent.getSource().setValueState(sap.ui.core.ValueState.None);
				oEvent.getSource().setValueStateText("");
				// var oInput = oEvent.getSource().getValue();
				// oInput = Number(oInput).toFixed(2);
				// oEvent.getSource().setValue(oInput);
			}

		},
		_checkLengthSupplier: function (oEvent) {
			if (oEvent.getSource().getValue().length > 10) {
				oEvent.getSource().setValue(oEvent.getSource().getValue().slice(0, -1));
			} else if (oEvent.getSource().getValue() < 0) {
				oEvent.getSource().setValue(0);
			}
		},
		onDeleteAll: function (oEvent) {
			var obj = this._oComponent.getModel("defaultValueModel").getData();
			obj.RequestItem = [];
			this._oComponent.getModel("defaultValueModel").setData(obj);
			this._oComponent.getModel("defaultValueModel").refresh(true);
		},
		_formatNumberPrice: function (value) {
			var oFormat = sap.ui.core.format.NumberFormat.getIntegerInstance({
				decimals: 2,
				precision: "13",
				groupingSeparator: "",
				decimalSeparator: "."
			});
			if (value && oFormat.format(value).length <= 11 && oFormat.format(value) > 0) {
				return oFormat.format(value);
			} else {
				return oFormat.format("0");
			}
		},
		_formatNumberQA: function (value) {
			var oFormat = sap.ui.core.format.NumberFormat.getIntegerInstance({
				decimals: 0,
				precision: "3",
				groupingSeparator: ""
			});
			if (oFormat.format(value) > 100) {
				value = "100";
			} else if (oFormat.format(value) <= 0) {
				value = "0";
			}
			return oFormat.format(value);
		},
		_checkQueueOwner: function (that, RequestNumber) {
			var MyInboxSet = that._oComponent.getModel("tableEntriesModel").getData().MyInboxSet;
			var Username = that._oComponent.getModel("fieldHandlingModel").getData().UserDetails.Username;
			var oQueueOwner = [];
			if (MyInboxSet) {
				var QueueOwner = MyInboxSet.filter(function (value) {
					return value.RequestNumber === RequestNumber;
				}).map(function (value) {
					return value.QueueOwner;
				})[0];
				oQueueOwner.push({
					Owner: QueueOwner
				});

				var AllApproverId = MyInboxSet.filter(function (value) {
					return value.RequestNumber === RequestNumber;
				}).map(function (value) {
					return value.AllApproverId;
				})[0];
				if (AllApproverId !== "" && AllApproverId !== undefined) {
					AllApproverId = AllApproverId.split("\r\n");
					AllApproverId.forEach(async function (ApproverId) {
						oQueueOwner.push({
							Owner: ApproverId
						});
					});

				}
				if (oQueueOwner.findIndex(QueueOwner => QueueOwner.Owner === Username) === -1) {
					return false;
				} else {
					return true;
				}

			}
		}
	});

});