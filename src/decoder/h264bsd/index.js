import { mergeBuffer, readBuffer } from '../../utils';
import H264bsdCanvas from './h264bsd_canvas';
import workerString from './h264bsd.worker';

export default class Decoder {
    constructor(flv) {
        const {
            player: { canvas },
            events: { proxy },
        } = flv;

        const blobUrl = new Blob([workerString], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blobUrl);
        const h264bsdDecoder = new Worker(workerUrl);
        const h264bsdDisplay = new H264bsdCanvas(canvas);

        proxy(h264bsdDecoder, 'message', event => {
            const message = event.data;
            if (!message.hasOwnProperty('type')) return;
            switch (message.type) {
                case 'pictureParams': {
                    const { croppingParams } = message;
                    if (croppingParams === null) {
                        canvas.width = message.width;
                        canvas.height = message.height;
                    } else {
                        canvas.width = croppingParams.width;
                        canvas.height = croppingParams.height;
                    }
                    break;
                }
                case 'pictureReady':
                    h264bsdDisplay.drawNextOutputPicture(
                        message.width,
                        message.height,
                        message.croppingParams,
                        new Uint8Array(message.data),
                    );
                    break;
                default:
                    break;
            }
        });

        let sps = null;
        let pps = null;
        flv.on('videoData', nalu => {
            const readNalu = readBuffer(nalu);
            readNalu(4);
            const nalHeader = readNalu(1)[0];
            const naluType = nalHeader & 31;
            switch (naluType) {
                case 1:
                case 5: {
                    const frame = mergeBuffer(sps, pps, nalu);
                    h264bsdDecoder.postMessage({ type: 'queueInput', data: frame.buffer }, [frame.buffer]);
                    break;
                }
                case 7:
                    sps = nalu;
                    break;
                case 8:
                    pps = nalu;
                    break;
                default:
                    break;
            }
        });
    }
}