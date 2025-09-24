// UI処理のプレースホルダー
import { Logger } from './utils/logger.js';

export class UIHandlers {
    constructor() {
        this.logger = new Logger('UIHandlers');
    }

    validateAndConvertExcelData(rawData) {
        this.logger.info('Excel データ検証・変換（未実装）');
        return [];
    }

    updateGpsPointCount(gpsData) {
        const element = document.getElementById('gpsPointCount');
        if (element) {
            element.value = gpsData ? gpsData.getPoints().length : 0;
        }
    }

    updatePointCoordCount(pointJsonData) {
        const element = document.getElementById('pointCount');
        if (element && pointJsonData && pointJsonData.points) {
            element.value = pointJsonData.points.length;
        }
    }

    updateRouteSpotCount(routeSpotHandler) {
        const routeElement = document.getElementById('routeCount');
        const spotElement = document.getElementById('spotCount');

        if (routeElement) {
            routeElement.value = routeSpotHandler ? routeSpotHandler.routeMarkers.length : 0;
        }
        if (spotElement) {
            spotElement.value = routeSpotHandler ? routeSpotHandler.spotMarkers.length : 0;
        }
    }

    updateMatchResults(result) {
        const matchedElement = document.getElementById('matchedPointCountField');
        const unmatchedElement = document.getElementById('unmatchedPointsField');

        if (matchedElement) {
            matchedElement.value = result.matchedPairs ? result.matchedPairs.length : 0;
        }
        if (unmatchedElement) {
            unmatchedElement.value = result.unmatchedPoints ? result.unmatchedPoints.join(', ') : '';
        }
    }
}