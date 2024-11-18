 //Factory Definition
 sap.ui.define([
 		"sap/m/ColumnListItem",
 		"sap/ui/core/Item",
 		"sap/m/Text",
 		"sap/m/Input",
 		"sap/m/ComboBox",
 		"sap/m/Button",
 		"sap/m/CheckBox",
 		"sap/ui/core/ListItem",
 		"sap/m/Select",
 		"sap/m/MessagePopover",
 		"sap/m/MessageItem",
 		"sap/m/ObjectIdentifier",
 		"sap/m/ObjectStatus"
 	], function (ColumnListItem, Item, Text, Input, ComboBox, Button, CheckBox, ListItem, Select, MessagePopover, MessageItem,
 		ObjectIdentifier, ObjectStatus) {
 		"use strict";
 		var FactoryDefinition = {
 			factory: function (id, context) {
 				//***********Display message popover start******************					
 				var oValidationError = context.getProperty("ValidationError"),
 					oPartNo = "",
 					oMPN = "",
 					oSupplier = "",
 					oQA,
 					oPartNoError, oQAError, oMPNError, oSupplierError;
 				var oButtonvisible = false;

 				if (oValidationError !== undefined && oValidationError !== "") {
 					var oButtonLength = oValidationError.length;
 					oValidationError.forEach(function (Error) {
 						oButtonvisible = true;
 						if (Error.fieldname !== undefined) {
 							switch (Error.fieldname) {
 							case "Part No.":
 								oPartNo = oPartNo + Error.message + "\r\n";
 								oPartNoError = "Error";
 								break;
 							case "QA":
 								oQA = oQA + Error.message + "\r\n";
 								oQAError = "Error";
 								break;
 							case "MPN":
 								oMPN = oMPN + Error.message + "\r\n";
 								oMPNError = "Error";
 								break;
 							case "Supplier":
 								oSupplier = oSupplier + Error.message + "\r\n";
 								oSupplierError = "Error";
 								break;
 							}
 						}
 					});
 				}
 				var oPath = "defaultValueModel>" + context.sPath + "/ValidationError";
 				var oMessageTemplate = new MessageItem({
 					type: '{defaultValueModel>type}',
 					title: '{defaultValueModel>fieldname}',
 					activeTitle: "{active}",
 					description: '{defaultValueModel>message}',
 					subtitle: '{defaultValueModel>message}',
 					counter: '{counter}'
 				});

 				var oMessagePopover = new MessagePopover({
 					items: {
 						path: oPath,
 						template: oMessageTemplate
 					}
 				});
 				//***********Display message popover End****************** 				
 				var oUserDetails = context.getProperty("UserDetails");
 				var oStatus = context.getProperty("Status");
 				var oInitiator = context.getProperty("Initiator");
 				if (oUserDetails !== undefined && oStatus !== undefined && oInitiator !== undefined) {
 					if (oUserDetails.Buyer === true && oUserDetails.Username === oInitiator && (oStatus === "001" || oStatus === "004")) {
 						var oCommonPart = context.getProperty("CommonPart"),
 							oSelected;
 						if (oCommonPart.toUpperCase() === "YES") {
 							oSelected = true;
 						} else {
 							oSelected = false;
 						}

 						return new ColumnListItem({
 							cells: [
 								new Input({
 									value: "{defaultValueModel>PartNo}",
 									valueState: oPartNoError,
 									valueStateText: oPartNo,
 									type: sap.m.InputType.Text,
 									maxLength: 40,
 									change: [
 										this.onInputChange,
 										this
 									]
 								}),
 								new Input({
 									value: "{defaultValueModel>SupplierName}",
 									valueState: oSupplierError,
 									valueStateText: oSupplier,
 									type: sap.m.InputType.Number,
 									liveChange: [
 										this._checkLengthSupplier,
 										this
 									],
 									change: [
 										this.onInputChange,
 										this
 									]
 								}),
 								new Input({
 									value: "{defaultValueModel>MPN}",
 									valueState: oMPNError,
 									valueStateText: oMPN,
 									type: sap.m.InputType.Text,
 									maxLength: 40,
 									change: [
 										this.onInputChange,
 										this
 									]
 								}),
 								new Input({
 									value: "{defaultValueModel>CostRollPrice}",
 									type: sap.m.InputType.Text,
 									maxLength: 11,
 									change: [
 										this.onPriceInputChange,
 										this
 									]
 								}),
 								new Select({
 									selectedKey: "{defaultValueModel>Source}",
 									width: "100%",
 									change: [
 										this.onInputChange,
 										this
 									],
 									items: {
 										path: "defaultValueModel>/SourceSet",
 										template: new ListItem({
 											key: "{defaultValueModel>SourceName}",
 											text: "{defaultValueModel>SourceName}"

 										})
 									}
 								}),

 								new Input({
 									value: "{defaultValueModel>QA}",
 									type: sap.m.InputType.Text,
 									valueState: oQAError,
 									valueStateText: oQA,
 									change: [
 										this.onQAInput,
 										this
 									]

 								}),
 								new CheckBox({
 									selected: oSelected,
 									select: [
 										this.onCommonPartSelect,
 										this
 									]
 								}),
 								new Button({
 									icon: "sap-icon://message-popup",
 									visible: oButtonvisible,
 									text: oButtonLength,
 									type: "Reject",
 									press: function (oEvent) {
 										oMessagePopover.toggle(oEvent.getSource());
 										oEvent.getSource().addDependent(oMessagePopover);
 									}
 								}),
 								new Text({
 									text: ""
 								}),
 								new Button({
 									icon: "sap-icon://display",
 									press: [
 										this.showDetails,
 										this
 									]
 								})

 							]
 						});

 					} else {
 						var Posting = context.getProperty("Posting");
 						var PostingVisible = true;
 						var Status = "",
 							Icon = "",
 							Type = "";
 						if (Posting !== undefined) {
 							if (Posting === "S") {
 								Status = "Success";
 								Icon = "sap-icon://sys-enter-2";
 								Type = "Accept";
 							} else if (Posting === "E") {
 								Status = "Error";
 								Icon = "sap-icon://error";
 								Type = "Reject";
 							} else {
 								PostingVisible = false;
 								Status = "Error";
 								Icon = "sap-icon://error";
 								Type = "Reject";
 							}
 						}
 						// }
 						return new ColumnListItem({
 							cells: [
 								new ObjectIdentifier({
 									title: "{defaultValueModel>PartNo}"
 								}),
 								new Text({
 									text: "{defaultValueModel>SupplierName}-{defaultValueModel>SupplierNameText}"
 								}),
 								new Text({
 									text: "{defaultValueModel>MPN}"
 								}),
 								new Text({
 									text: "{defaultValueModel>CostRollPrice}"
 								}),
 								new Text({
 									text: "{defaultValueModel>Source}"
 								}),
 								new Text({
 									text: "{defaultValueModel>QA}"
 								}),
 								new Text({
 									text: "{defaultValueModel>CommonPart}"
 								}),
 								new Button({
 									icon: "sap-icon://message-popup",
 									visible: oButtonvisible,
 									text: oButtonLength,
 									type: Type,
 									press: function (oEvent) {
 										oMessagePopover.toggle(oEvent.getSource());
 										oEvent.getSource().addDependent(oMessagePopover);
 									}
 								}),
 								new ObjectStatus({
 									text: Status,
 									icon: Icon,
 									state: Status,
 									visible: PostingVisible
 								}),
 								new Button({
 									icon: "sap-icon://display",
 									press: [
 										this.showDetails,
 										this
 									]
 								})
 							]
 						});
 					}
 				} else {

 					return new ColumnListItem({
 						cells: [new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							}),
 							new Text({
 								text: ""
 							})
 						]
 					});

 				}
 			}
 		};
 		return FactoryDefinition;
 	},

 	true);