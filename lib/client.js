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
exports.Transport = void 0;
const stream_1 = require("./stream");
const API_CHANNEL = 'ion-sfu';
const ERR_NO_SESSION = 'no active session, join first';
var Role;
(function (Role) {
    Role[Role["pub"] = 0] = "pub";
    Role[Role["sub"] = 1] = "sub";
})(Role || (Role = {}));
class Transport {
    constructor(role, signal, config) {
        this.signal = signal;
        this.pc = new RTCPeerConnection(config);
        this.candidates = [];
        if (role === Role.pub) {
            this.pc.createDataChannel(API_CHANNEL);
        }
        this.pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                this.signal.trickle({ target: role, candidate });
            }
        };
        this.pc.oniceconnectionstatechange = (e) => __awaiter(this, void 0, void 0, function* () {
            if (this.pc.iceConnectionState === 'disconnected') {
                if (this.pc.restartIce !== undefined) {
                    // this will trigger onNegotiationNeeded
                    this.pc.restartIce();
                }
            }
        });
    }
}
exports.Transport = Transport;
class Client {
    constructor(signal, config = {
        codec: 'vp8',
        iceServers: [
            {
                urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
            },
        ],
    }) {
        this.signal = signal;
        this.config = config;
        signal.onnegotiate = this.negotiate.bind(this);
        signal.ontrickle = this.trickle.bind(this);
    }
    join(sid, uid, name) {
        return __awaiter(this, void 0, void 0, function* () {
            this.transports = {
                [Role.pub]: new Transport(Role.pub, this.signal, this.config),
                [Role.sub]: new Transport(Role.sub, this.signal, this.config),
            };
            this.transports[Role.sub].pc.ontrack = (ev) => {
                const stream = ev.streams[0];
                const remote = stream_1.makeRemote(stream, this.transports[Role.sub]);
                if (this.ontrack) {
                    this.ontrack(ev.track, remote);
                }
            };
            const apiReady = new Promise((resolve) => {
                this.transports[Role.sub].pc.ondatachannel = (ev) => {
                    if (ev.channel.label === API_CHANNEL) {
                        this.transports[Role.sub].api = ev.channel;
                        this.transports[Role.pub].api = ev.channel;
                        ev.channel.onmessage = (e) => {
                            try {
                                const msg = JSON.parse(e.data);
                                this.processChannelMessage(msg);
                            }
                            catch (err) {
                                /* tslint:disable-next-line:no-console */
                                console.error(err);
                            }
                        };
                        resolve();
                        return;
                    }
                    if (this.ondatachannel) {
                        this.ondatachannel(ev);
                    }
                };
            });
            const offer = yield this.transports[Role.pub].pc.createOffer();
            yield this.transports[Role.pub].pc.setLocalDescription(offer);
            const answer = yield this.signal.join(sid, uid, name, offer);
            yield this.transports[Role.pub].pc.setRemoteDescription(answer);
            this.transports[Role.pub].candidates.forEach((c) => this.transports[Role.pub].pc.addIceCandidate(c));
            this.transports[Role.pub].pc.onnegotiationneeded = this.onNegotiationNeeded.bind(this);
            return apiReady;
        });
    }
    leave() {
        if (this.transports) {
            Object.values(this.transports).forEach((t) => t.pc.close());
            delete this.transports;
        }
    }
    getPubStats(selector) {
        if (!this.transports) {
            throw Error(ERR_NO_SESSION);
        }
        return this.transports[Role.pub].pc.getStats(selector);
    }
    getSubStats(selector) {
        if (!this.transports) {
            throw Error(ERR_NO_SESSION);
        }
        return this.transports[Role.sub].pc.getStats(selector);
    }
    publish(stream, encodingParams) {
        if (!this.transports) {
            throw Error(ERR_NO_SESSION);
        }
        stream.publish(this.transports[Role.pub], encodingParams);
    }
    restartIce() {
        this.renegotiate(true);
    }
    createDataChannel(label) {
        if (!this.transports) {
            throw Error(ERR_NO_SESSION);
        }
        return this.transports[Role.pub].pc.createDataChannel(label);
    }
    close() {
        if (this.transports) {
            Object.values(this.transports).forEach((t) => t.pc.close());
        }
        this.signal.close();
    }
    trickle({ candidate, target }) {
        if (!this.transports) {
            throw Error(ERR_NO_SESSION);
        }
        if (this.transports[target].pc.remoteDescription) {
            this.transports[target].pc.addIceCandidate(candidate);
        }
        else {
            this.transports[target].candidates.push(candidate);
        }
    }
    negotiate(description) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.transports) {
                throw Error(ERR_NO_SESSION);
            }
            let answer;
            try {
                yield this.transports[Role.sub].pc.setRemoteDescription(description);
                this.transports[Role.sub].candidates.forEach((c) => this.transports[Role.sub].pc.addIceCandidate(c));
                this.transports[Role.sub].candidates = [];
                answer = yield this.transports[Role.sub].pc.createAnswer();
                yield this.transports[Role.sub].pc.setLocalDescription(answer);
                this.signal.answer(answer);
            }
            catch (err) {
                /* tslint:disable-next-line:no-console */
                console.error(err);
                if (this.onerrnegotiate)
                    this.onerrnegotiate(Role.sub, err, description, answer);
            }
        });
    }
    onNegotiationNeeded() {
        this.renegotiate(false);
    }
    renegotiate(iceRestart) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.transports) {
                throw Error(ERR_NO_SESSION);
            }
            let offer;
            let answer;
            try {
                offer = yield this.transports[Role.pub].pc.createOffer({ iceRestart });
                yield this.transports[Role.pub].pc.setLocalDescription(offer);
                answer = yield this.signal.offer(offer);
                yield this.transports[Role.pub].pc.setRemoteDescription(answer);
            }
            catch (err) {
                /* tslint:disable-next-line:no-console */
                console.error(err);
                if (this.onerrnegotiate)
                    this.onerrnegotiate(Role.pub, err, offer, answer);
            }
        });
    }
    processChannelMessage(msg) {
        if (msg.method !== undefined && msg.params !== undefined) {
            switch (msg.method) {
                case 'audioLevels':
                    if (this.onspeaker) {
                        this.onspeaker(msg.params);
                    }
                    break;
                case 'activeLayer':
                    if (this.onactivelayer) {
                        this.onactivelayer(msg.params);
                    }
                    break;
                default:
                // do nothing
            }
        }
        else {
            // legacy channel message - payload contains audio levels
            if (this.onspeaker) {
                this.onspeaker(msg);
            }
        }
    }
}
exports.default = Client;
