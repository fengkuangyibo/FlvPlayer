import fetchRequest from './fetchRequest';
import mozXhrRequest from './mozXhrRequest';
import xhrRequest from './xhrRequest';
import websocketRequest from './websocketRequest';
import readFile from './readFile';

export default class Stream {
    constructor(flv) {
        this.flv = flv;
        this.reconnectTime = 0;
        this.maxReconnectTime = 10;
        this.transportFactory = Stream.getStreamFactory(flv.options.url);
        this.flv.debug.log('stream-type', this.transportFactory.name);
        this.transport = this.transportFactory(flv, this);

        flv.on('destroy', () => {
            this.flv.emit('streamCancel');
        });

        flv.on('reconnect', () => {
            this.reconnect();
        });
    }

    static supportsXhrResponseType(type) {
        try {
            const tmpXhr = new XMLHttpRequest();
            tmpXhr.responseType = type;
            return tmpXhr.responseType === type;
        } catch (e) {
            return false;
        }
    }

    static getStreamFactory(url) {
        if (url instanceof File) {
            return readFile;
        }

        if (url.startsWith('ws://')) {
            return websocketRequest;
        }

        if (
            typeof Response !== 'undefined' &&
            Object.prototype.hasOwnProperty.call(Response.prototype, 'body') &&
            typeof Headers === 'function'
        ) {
            return fetchRequest;
        }

        const mozChunked = 'moz-chunked-arraybuffer';
        if (Stream.supportsXhrResponseType(mozChunked)) {
            return mozXhrRequest;
        }

        return xhrRequest;
    }

    reconnect() {
        if (this.reconnectTime < this.maxReconnectTime && !this.flv.isDestroy && this.flv.options.live) {
            setTimeout(() => {
                this.reconnectTime += 1;
                this.flv.emit('streamCancel');
                this.transport = this.transportFactory(this.flv, this);
                this.flv.debug.warn(false, `[stream]: reconnect ${this.reconnectTime}`);
                this.flv.emit('streamReconnect');
            }, 1000);
        }
    }
}
