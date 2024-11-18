/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"CostRoll/Z_FICO_IMACIPO_CR/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});