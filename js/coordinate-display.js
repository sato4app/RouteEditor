// 座標表示機能のプレースホルダー
import { Logger } from './utils/logger.js';

export class CoordinateDisplay {
    constructor(mapCore, imageOverlay) {
        this.logger = new Logger('CoordinateDisplay');
        this.mapCore = mapCore;
        this.imageOverlay = imageOverlay;
    }

    async displayImageCoordinates(data, type, existingMarkers) {
        this.logger.info('画像座標表示（未実装）');
        return existingMarkers || [];
    }
}