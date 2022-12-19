"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IonSFUJSONRPCSignal = void 0;
const uuid_1 = require("uuid");
class IonSFUJSONRPCSignal {
    constructor(uri) {
        this.socket = new WebSocket(uri);
        this._notifyhandlers = {};
        this.socket.addEventListener('open', () => {
            if (this._onopen)
                this._onopen();
        });
        this.socket.addEventListener('error', (e) => {
            if (this._onerror)
                this._onerror(e);
        });
        this.socket.addEventListener('close', (e) => {
            if (this._onclose)
                this._onclose(e);
        });
        this.socket.addEventListener('message', (event) => __awaiter(this, void 0, void 0, function* () {
            const resp = JSON.parse(event.data);
            if (resp.method === 'offer') {
                if (this.onnegotiate)
                    this.onnegotiate(resp.params);
            }
            else if (resp.method === 'trickle') {
                if (this.ontrickle)
                    this.ontrickle(resp.params);
            }
            else {
                const handler = this._notifyhandlers[resp.method];
                if (handler) {
                    handler(resp.params);
                }
            }
        }));
    }
    on_notify(method, cb) {
        this._notifyhandlers[method] = cb;
    }
    // JsonRPC2 Call
    call(method, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = uuid_1.v4();
            this.socket.send(JSON.stringify({
                method,
                params,
                id,
            }));
            return new Promise((resolve, reject) => {
                const handler = (event) => {
                    const resp = JSON.parse(event.data);
                    if (resp.id === id) {
                        if (resp.error)
                            reject(resp.error);
                        else
                            resolve(resp.result);
                        this.socket.removeEventListener('message', handler);
                    }
                };
                this.socket.addEventListener('message', handler);
            });
        });
    }
    // JsonRPC2 Notification
    notify(method, params) {
        this.socket.send(JSON.stringify({
            method,
            params,
        }));
    }
    join(sid, uid, name, offer) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.call('join', { sid, uid, name, offer });
        });
    }
    trickle(trickle) {
        this.notify('trickle', trickle);
    }
    offer(offer) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.call('offer', { desc: offer });
        });
    }
    answer(answer) {
        this.notify('answer', { desc: answer });
    }
    close() {
        this.socket.close();
    }
    set onopen(onopen) {
        if (this.socket.readyState === WebSocket.OPEN) {
            onopen();
        }
        this._onopen = onopen;
    }
    set onerror(onerror) {
        this._onerror = onerror;
    }
    set onclose(onclose) {
        this._onclose = onclose;
    }
}
exports.IonSFUJSONRPCSignal = IonSFUJSONRPCSignal;
