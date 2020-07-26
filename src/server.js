const EventEmitter = require("events");
const Connection = require("./connection");

const express = require("express");
const bodyParser = require("body-parser");

class LongPollingServer extends EventEmitter {
	constructor(options) {
		super();

		this.connections = {};

		var server = express();

		// Connect

		server.get("/connect", (req, res) => {
			var connection = new Connection(req);
			this.connections[connection.id] = connection;
			this.emit("connection", connection, req);

			res.status(201).send({
				id: connection.id
			});
		});

		server.use((req, res, next) => { // Authentication middleware
			var connection = this.connections[req.headers["connection-id"]];
			if (connection) {
				req.connection = connection;
				next();
			} else {
				res.status(401).send({
					error: "Not connected"
				});
			}
		});

		server.get("/disconnect", (req, res) => {
			req.connection.emit("disconnect");

			delete this.connections[req.connection.id];
			res.status(200).send("ok");
		});

		// Get/recieve

		server.get("/data", (req, res) => {
			req.connection.onRequest(req, res);
		});

		server.post("/data", bodyParser.json(), (req, res) => {
			if (req.body.t) {
				req.connection.emit(req.body.t, req.body.d);
				res.status(200).send("ok");
			} else {
				res.status(400).send({
					error: "Invalid target"
				});
			}
		});

		this.server = server;
	}

	broadcast(target, data) {
		Object.keys(this.connections).forEach((id) => {
			this.connections[id].send(target, data);
		});
	}

	broadcastToApiKey(key, target, data) {
		Object.keys(this.connections).forEach((id) => {
			var parsedKey = this.connections[id].apikey
			if (parsedKey === key) {
				this.connections[id].send(target, data);
			}
		})
	}

	listen(...args) {
		this.server.listen(...args);
	}
}

module.exports = LongPollingServer;