// ルート最適化と経路線描画を専門に扱うモジュール
export class RouteOptimizer {
    constructor(map, gpsData) {
        this.map = map;
        this.gpsData = gpsData;
        this.routeLines = [];
    }

    // ルートデータからウェイポイント配列を取得する統一メソッド
    getWaypoints(routeData) {
        return routeData.wayPoint || routeData.wayPoints || routeData.points || [];
    }

    // ルートデータからスタート/エンドポイント名を取得する統一メソッド
    getRoutePoints(routeData) {
        return {
            startPoint: routeData.startPoint || routeData.start || routeData.startPointId || (routeData.routeInfo && routeData.routeInfo.startPoint),
            endPoint: routeData.endPoint || routeData.end || routeData.endPointId || (routeData.routeInfo && routeData.routeInfo.endPoint)
        };
    }

    // 複数ルートの経路線を一度に描画する機能
    drawMultipleRouteSegments(routes, convertImageToMapCoordinates) {
        if (!routes || routes.length === 0) {
            return;
        }

        try {
            // 既存の経路線をクリア
            this.clearRouteLines();

            // 各ルートについて経路線を描画
            routes.forEach((route, routeIndex) => {
                this.drawSingleRouteSegment(route, convertImageToMapCoordinates, routeIndex);
            });

        } catch (error) {
            // 複数ルート経路線描画エラー（無視）
        }
    }

    // 単一ルートの経路線を描画（内部用）
    drawSingleRouteSegment(route, convertImageToMapCoordinates, routeIndex = 0) {
        try {
            // 開始・終了ポイント名を取得
            const { startPoint: startPointName, endPoint: endPointName } = this.getRoutePoints(route);
            
            // 開始・終了ポイントを取得
            const startPoint = this.getGpsPointByName(startPointName);
            const endPoint = this.getGpsPointByName(endPointName);

            if (!startPoint || !endPoint) {
                // 開始または終了ポイントが見つからない（無視）
                return;
            }

            // 中間点を取得してindex順でソート
            const wayPoints = this.getWaypoints(route);
            const sortedWayPoints = [...wayPoints].sort((a, b) => (a.index || 0) - (b.index || 0));

            // ルートポイントの座標配列を構築
            const routeCoordinates = [];

            // 開始ポイントを追加
            routeCoordinates.push([startPoint.latitude, startPoint.longitude]);

            // 中間点を追加
            for (const waypoint of sortedWayPoints) {
                const mapPosition = convertImageToMapCoordinates(waypoint.imageX, waypoint.imageY);
                if (mapPosition) {
                    routeCoordinates.push(mapPosition);
                }
            }

            // 終了ポイントを追加
            routeCoordinates.push([endPoint.latitude, endPoint.longitude]);

            // 線を描画（すべて赤色で統一）
            if (routeCoordinates.length >= 2) {
                const routeLine = L.polyline(routeCoordinates, {
                    color: '#ff0000',
                    weight: 2,
                    opacity: 0.8,
                    smoothFactor: 1,
                    pane: 'routeLines'
                });

                routeLine.addTo(this.map);
                this.routeLines.push(routeLine);
            }

        } catch (error) {
            // ルート描画エラー（無視）
        }
    }

    // 経路線を描画する機能（既存）
    drawRouteSegments(selectedRoute, convertImageToMapCoordinates) {
        if (!selectedRoute) {
            throw new Error('ルートを選択してください。');
        }

        try {
            // 既存の経路線をクリア
            this.clearRouteLines();

            // 開始・終了ポイント名を取得
            const { startPoint: startPointName, endPoint: endPointName } = this.getRoutePoints(selectedRoute);
            
            // 開始・終了ポイントを取得
            const startPoint = this.getGpsPointByName(startPointName);
            const endPoint = this.getGpsPointByName(endPointName);

            if (!startPoint) {
                throw new Error('開始ポイントが見つかりません。');
            }

            if (!endPoint) {
                throw new Error('終了ポイントが見つかりません。');
            }

            // 中間点を取得してindex順でソート
            const wayPoints = this.getWaypoints(selectedRoute);
            const sortedWayPoints = [...wayPoints].sort((a, b) => (a.index || 0) - (b.index || 0));

            // ルートポイントの座標配列を構築
            const routeCoordinates = [];

            // 開始ポイントを追加
            routeCoordinates.push([startPoint.latitude, startPoint.longitude]);

            // 中間点を追加
            for (const waypoint of sortedWayPoints) {
                const mapPosition = convertImageToMapCoordinates(waypoint.imageX, waypoint.imageY);
                if (mapPosition) {
                    routeCoordinates.push(mapPosition);
                }
            }

            // 終了ポイントを追加
            routeCoordinates.push([endPoint.latitude, endPoint.longitude]);

            // 線を描画
            if (routeCoordinates.length >= 2) {
                const routeLine = L.polyline(routeCoordinates, {
                    color: '#ff0000',
                    weight: 2,
                    opacity: 0.8,
                    smoothFactor: 1,
                    pane: 'routeLines'
                });

                routeLine.addTo(this.map);
                this.routeLines.push(routeLine);
            }

        } catch (error) {
            throw new Error(`経路線の描画中にエラーが発生しました: ${error.message}`);
        }
    }

    // ルート最適化機能（中間点の順序を最適化して総距離を最小化）
    optimizeRoute(selectedRoute, convertImageToMapCoordinates) {
        if (!selectedRoute) {
            throw new Error('ルートを選択してください。');
        }

        try {
            // 開始・終了ポイントを取得
            const { startPoint: startPointName, endPoint: endPointName } = this.getRoutePoints(selectedRoute);
            
            const startPoint = this.getGpsPointByName(startPointName);
            const endPoint = this.getGpsPointByName(endPointName);

            if (!startPoint || !endPoint) {
                throw new Error('開始または終了ポイントが見つかりません。');
            }

            // 中間点を取得
            const wayPoints = this.getWaypoints(selectedRoute);
            if (wayPoints.length === 0) {
                throw new Error('最適化する中間点がありません。');
            }

            // 中間点を地図座標に変換
            const waypointCoords = [];
            for (const waypoint of wayPoints) {
                const mapPosition = convertImageToMapCoordinates(waypoint.imageX, waypoint.imageY);
                if (mapPosition) {
                    waypointCoords.push({
                        ...waypoint,
                        lat: mapPosition[0],
                        lng: mapPosition[1]
                    });
                }
            }

            // 最適化前の距離を計算
            const originalDistance = this.calculateTotalDistance(startPoint, endPoint, waypointCoords);

            // 最適化を実行（貪欲法）
            const optimizedOrder = this.optimizeWaypointOrder(startPoint, endPoint, waypointCoords);

            // 最適化後の距離を計算
            const optimizedDistance = this.calculateTotalDistance(startPoint, endPoint, optimizedOrder);

            // 最適化されたindexでwayPointsを更新
            optimizedOrder.forEach((waypoint, index) => {
                waypoint.index = index + 1;
            });

            return optimizedOrder;

        } catch (error) {
            throw new Error(`ルートの最適化中にエラーが発生しました: ${error.message}`);
        }
    }

    // 2点間の距離を計算（メートル単位）
    calculateDistance(point1, point2) {
        const lat1 = point1.lat || point1.latitude;
        const lng1 = point1.lng || point1.longitude;
        const lat2 = point2.lat || point2.latitude;
        const lng2 = point2.lng || point2.longitude;

        const R = 6371000; // 地球の半径（メートル）
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    // 経路の総距離を計算
    calculateTotalDistance(startPoint, endPoint, waypoints) {
        if (waypoints.length === 0) {
            return this.calculateDistance(startPoint, endPoint);
        }

        let totalDistance = 0;
        let currentPoint = startPoint;

        // 開始点から各中間点を経由
        for (const waypoint of waypoints) {
            totalDistance += this.calculateDistance(currentPoint, waypoint);
            currentPoint = waypoint;
        }

        // 最後の中間点から終了点まで
        totalDistance += this.calculateDistance(currentPoint, endPoint);

        return totalDistance;
    }

    // 貪欲法による中間点順序最適化
    optimizeWaypointOrder(startPoint, endPoint, waypoints) {
        if (waypoints.length <= 1) {
            return [...waypoints];
        }

        const optimizedOrder = [];
        const remaining = [...waypoints];
        let currentPoint = startPoint;

        // 貪欲法: 現在地点から最も近い点を順次選択
        while (remaining.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = this.calculateDistance(currentPoint, remaining[0]);

            for (let i = 1; i < remaining.length; i++) {
                const distance = this.calculateDistance(currentPoint, remaining[i]);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = i;
                }
            }

            const nearestWaypoint = remaining.splice(nearestIndex, 1)[0];
            optimizedOrder.push(nearestWaypoint);
            currentPoint = nearestWaypoint;
        }

        return optimizedOrder;
    }

    // GPSポイントを名前で検索
    getGpsPointByName(pointName) {
        if (!this.gpsData || !pointName) {
            return null;
        }

        // GPSDataクラスのgetGPSMarkers()メソッドを使用してGPSポイントを取得
        const gpsMarkers = this.gpsData.getGPSMarkers();
        if (!gpsMarkers || gpsMarkers.length === 0) {
            return null;
        }

        // pointName（ポイントID）で検索
        const foundMarker = gpsMarkers.find(marker => marker.id === pointName);
        if (foundMarker) {
            return {
                id: foundMarker.id,
                latitude: foundMarker.lat,
                longitude: foundMarker.lng,
                data: foundMarker.data
            };
        }

        return null;
    }

    // 経路線をクリア
    clearRouteLines() {
        this.routeLines.forEach(line => {
            if (this.map.hasLayer(line)) {
                this.map.removeLayer(line);
            }
        });
        this.routeLines = [];
    }
}