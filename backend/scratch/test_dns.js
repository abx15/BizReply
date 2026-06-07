"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = __importDefault(require("dns"));
dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
dns_1.default.resolveSrv('_mongodb._tcp.bizreply.8li9geq.mongodb.net', (err, addresses) => {
    console.log('Error:', err);
    console.log('Addresses:', addresses);
});
