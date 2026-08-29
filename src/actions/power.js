import streamDeck, { action } from "@elgato/streamdeck";
/** @typedef {import("@elgato/streamdeck").Action} Action */
/** @typedef {import("@elgato/streamdeck").KeyDownEvent} KeyDownEvent */
/** @typedef {import("@elgato/streamdeck").WillAppearEvent} WillAppearEvent */

import { PluginAction } from "./action";
/** @typedef {import("./action").ActionSettings} ActionSettings */

/** @typedef {import("../modules/connection").AVRConnection} AVRConnection */
/** @typedef {import("../modules/connection").ReceiverEvent} ReceiverEvent */

/**
 * The Power action class.
 * @extends {PluginAction}
 */
@action({ UUID: "com.mthiel.denon-controller.power" })
export class PowerAction extends PluginAction {
	/**
	 * Handle the action appearing on the Stream Deck.
	 * @param {WillAppearEvent} ev - The event object.
	 */
	async onWillAppear(ev) {
		await super.onWillAppear(ev);

		// Set the initial state of the action based on the receiver's power status
		const connection = this.avrConnections[this.actionReceiverMap[ev.action.id]?.uuid];
		const zone = /** @type {number} */ (ev.payload.settings.zone) || 0;
		updateActionState(ev.action, connection, zone);
	}

	/**
	 * Perform the configured power action when the key is pressed.
	 * @param {KeyDownEvent} ev - The event object.
	 */
	onKeyDown(ev) {
		const connection = this.avrConnections[this.actionReceiverMap[ev.action.id].uuid];
		if (!connection) return;

		const settings = ev.payload.settings;
		const zone = /** @type {number} */ (settings.zone) || 0;
		const powerAction = settings.powerAction || "toggle";

		const actionMap = {
			toggle: undefined,
			on: true,
			off: false,
		};

		connection.setPower(actionMap[powerAction], zone) || ev.action.showAlert();
	}

	/**
	 * Handle a receiver power status changing, update actions accordingly.
	 * @param {ReceiverEvent} ev - The event object.
	 */
	onReceiverPowerChanged(ev) {
		if (!ev.actions) return;

		Promise.all(ev.actions.map(async (action) => updateActionState(action, ev.connection, ev.zone)));
	}
}

/**
 * Update the state of an action based on the receiver's power status.
 * @param {Action} action - The action object.
 * @param {AVRConnection} [connection] - The receiver connection object.
 * @param {number} [zone] - The zone that the power status changed for
 */
async function updateActionState(action, connection, zone) {
	const actionZone = (/** @type {ActionSettings} */ (await action.getSettings())).zone || 0;

	// Main Zone only (2) shares zone 0's routing bucket with Both (whole-unit master), since the
	// connection always reports Main Zone/master power changes on zone 0 - see routeReceiverEvent().
	const routingZone = actionZone === 2 ? 0 : actionZone;
	if (zone !== undefined && zone !== routingZone) { return; }

	let power;
	if (connection !== undefined) {
		switch (actionZone) {
			case 1: power = connection.status.zones[1].power; break; // Zone 2
			case 2: power = connection.status.zones[0].power; break; // Main Zone only
			default: power = connection.status.masterPower; break; // Both
		}
	}

	const state = power !== undefined ? power ? 0 : 1 : 1;
	if (action.isKey()) {
		action.setState(state);
	}
}