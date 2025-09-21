// ルートデータ管理と保存機能を専門に扱うモジュール
import { FileHandler } from './file-handler.js';

export class RouteDataManager {
    constructor(imageOverlay, gpsData) {
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.fileHandler = new FileHandler();
        this.loadedRoutes = [];
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

    // 複数のルートJSONファイルを一度に読み込む
    async loadMultipleRouteJSONs(files) {
        const loadPromises = [];
        
        for (let i = 0; i < files.length; i++) {
            loadPromises.push(
                this.loadRouteJSON(files[i])
                    .then(result => ({ success: true, result, fileName: files[i].name }))
                    .catch(error => ({ success: false, error: error.message, fileName: files[i].name }))
            );
        }
        
        try {
            const results = await Promise.all(loadPromises);
            
            // 成功した結果のみを抽出
            const successfulResults = results.filter(r => r.success).map(r => r.result);
            
            // エラーがあった場合の情報を収集（重大なエラーも含む）
            const errors = results.filter(r => !r.success);
            
            // エラー結果も含めて返す（呼び出し元でエラーメッセージを表示可能）
            return {
                successful: successfulResults,
                errors: errors,
                allResults: results
            };
        } catch (error) {
            throw new Error(`複数ファイル読み込み中に予期しないエラーが発生しました: ${error.message}`);
        }
    }

    // 単一のルートJSONファイルを読み込む
    loadRouteJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const routeData = JSON.parse(e.target.result);
                    
                    // JSONファイル内容の検証
                    const validationResult = this.validateRouteJSON(routeData);
                    if (!validationResult.isValid) {
                        // 重大なエラー（重複や開始=終了）の場合はエラーとして返す
                        const { startPoint, endPoint } = this.getRoutePoints(routeData);
                        const isDuplicate = validationResult.warnings.some(w => w.includes('既に読み込まれています'));
                        const isSamePoint = validationResult.warnings.some(w => w.includes('が同じです'));
                        
                        if (isDuplicate || isSamePoint) {
                            reject(new Error(validationResult.warnings.join('\n')));
                            return;
                        }
                        
                        // その他の警告は呼び出し元で処理
                        routeData._validationWarnings = validationResult.warnings;
                    }
                    
                    // ルートデータを保存（type、indexが設定されていない場合は初期化）
                    this.initializeWaypointData(routeData);
                    this.loadedRoutes.push(routeData);
                    
                    resolve(routeData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    }

    // ウェイポイントデータを初期化（type、indexが設定されていない場合）
    initializeWaypointData(routeData) {
        const wayPoints = this.getWaypoints(routeData);
        
        if (!wayPoints || !Array.isArray(wayPoints)) {
            return;
        }
        
        wayPoints.forEach((point, arrayIndex) => {
            // type が設定されていない場合は "waypoint" を設定
            if (!point.type) {
                point.type = "waypoint";
            }
            
            // index が設定されていない場合は配列のインデックス + 1 を設定
            if (point.index === undefined || point.index === null) {
                point.index = arrayIndex + 1;
            }
            
            // imageX, imageY を整数化（既存データの場合）
            if (point.imageX !== undefined) {
                point.imageX = Math.round(point.imageX);
            }
            if (point.imageY !== undefined) {
                point.imageY = Math.round(point.imageY);
            }
        });
    }

    // JSONファイル内容の検証
    validateRouteJSON(routeData) {
        const warnings = [];
        let isValid = true;
        
        // 実際のプロパティ名を動的に取得（routeInfo内も確認）
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        const wayPoint = this.getWaypoints(routeData);
        const wayPointCount = routeData.wayPointCount || routeData.waypointCount || (routeData.routeInfo && routeData.routeInfo.waypointCount);
        
        // 開始ポイントと終了ポイントが同じ場合のチェック
        if (startPoint && endPoint && startPoint === endPoint) {
            warnings.push(`開始ポイント "${startPoint}" と終了ポイント "${endPoint}" が同じです。異なるポイントを指定してください。`);
            isValid = false;
        }
        
        // 同じルート（開始・終了ポイントが同じ）の重複チェック
        if (startPoint && endPoint) {
            const existingRoute = this.findExistingRoute(startPoint, endPoint);
            if (existingRoute) {
                warnings.push(`同じルート（${startPoint} → ${endPoint}）は既に読み込まれています。重複する読み込みはスキップされます。`);
                isValid = false;
            }
        }
        
        // imageReferenceの値が読み込んでいるpng画像のファイル名と一致するかチェック
        if (routeData.imageReference && this.imageOverlay && this.imageOverlay.currentImageFileName) {
            if (routeData.imageReference !== this.imageOverlay.currentImageFileName) {
                warnings.push(`imageReference "${routeData.imageReference}" が読み込んでいる画像ファイル名 "${this.imageOverlay.currentImageFileName}" と一致しません。`);
                isValid = false;
            }
        }
        
        // wayPointCountの値がwayPointの件数と一致するかチェック
        if (wayPointCount !== undefined && wayPoint && Array.isArray(wayPoint)) {
            if (wayPointCount !== wayPoint.length) {
                warnings.push(`wayPointCount "${wayPointCount}" がwayPointの実際の件数 "${wayPoint.length}" と一致しません。`);
                isValid = false;
            }
        }
        
        // startPointとendPointがGPSポイントに一致するかチェック
        if (this.gpsData && this.gpsData.gpsPoints) {
            const gpsPointIds = this.gpsData.gpsPoints.map(point => point.id);
            
            if (startPoint && !gpsPointIds.includes(startPoint)) {
                warnings.push(`startPoint "${startPoint}" がGPSポイントに見つかりません。`);
                isValid = false;
            }
            
            if (endPoint && !gpsPointIds.includes(endPoint)) {
                warnings.push(`endPoint "${endPoint}" がGPSポイントに見つかりません。`);
                isValid = false;
            }
        }
        
        return { isValid, warnings };
    }

    // ルートデータ更新（wayPointCount、編集フラグ）
    updateRouteData(routeData) {
        // wayPointCountを更新
        if (routeData.wayPointCount !== undefined) {
            const wayPoints = this.getWaypoints(routeData);
            routeData.wayPointCount = wayPoints.length;
        }

        // ルートが編集されたことをマーク
        routeData.isEdited = true;
    }

    // ルート内のウェイポイントを更新する統一メソッド
    updateWaypointsInRoute(routeData, newWaypoints) {
        if (routeData.wayPoint) {
            routeData.wayPoint = newWaypoints;
        } else if (routeData.wayPoints) {
            routeData.wayPoints = newWaypoints;
        } else if (routeData.points) {
            routeData.points = newWaypoints;
        }
    }

    // 選択されているルートを保存する機能
    async saveSelectedRoute(selectedRoute) {
        if (!selectedRoute) {
            throw new Error('ルートを選択してください。');
        }

        try {
            // 保存用データの準備
            const saveData = this.prepareSaveData(selectedRoute);
            
            // ファイル名の生成（仕様に従う）
            const filename = this.generateSaveFilename(selectedRoute);
            
            // ファイル保存の実行
            const result = await this.fileHandler.saveJSONWithUserChoice(saveData, filename);
            
            // 保存結果に応じて処理
            if (result.success) {
                // 編集状態をクリア
                selectedRoute.isEdited = false;
                return { success: true, filename: result.filename || filename };
            } else {
                // キャンセルまたはエラーの場合
                if (result.error === 'キャンセル') {
                    return { success: false, cancelled: true };
                } else {
                    return { success: false, error: result.error || '保存に失敗しました。' };
                }
            }
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 保存用データを準備（サンプルファイル形式に従って保存）
    prepareSaveData(routeData) {
        const wayPoint = this.getWaypoints(routeData);
        
        if (!wayPoint || !Array.isArray(wayPoint)) {
            throw new Error('保存可能なルートデータがありません。');
        }

        // 保存データの構築（サンプル01の形式に合わせる）
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        const saveData = {
            routeInfo: {
                startPoint: startPoint || '',
                endPoint: endPoint || '',
                waypointCount: wayPoint.length
            },
            imageReference: this.imageOverlay.currentImageFileName || '',
            imageInfo: {
                width: this.imageOverlay.getImageDimensions?.()?.width || 726,
                height: this.imageOverlay.getImageDimensions?.()?.height || 624
            },
            points: wayPoint.map((point, arrayIndex) => ({
                type: point.type || "waypoint",
                index: point.index !== undefined ? point.index : arrayIndex + 1,
                imageX: Math.round(point.imageX || 0),
                imageY: Math.round(point.imageY || 0)
            })),
            exportedAt: new Date().toISOString()
        };

        return saveData;
    }

    // ファイル名の生成（仕様に従う）
    generateSaveFilename(routeData) {
        let imageFileName = this.imageOverlay.currentImageFileName || 'unknown';
        
        // PNG ファイルタイプを除去（.pngが含まれている場合は削除）
        if (imageFileName.toLowerCase().endsWith('.png')) {
            imageFileName = imageFileName.slice(0, -4);
        }
        
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        
        return `${imageFileName}_route_${startPoint || 'start'}_to_${endPoint || 'end'}.json`;
    }

    // 読み込まれたルート一覧を取得
    getLoadedRoutes() {
        return this.loadedRoutes;
    }

    // ルートを削除
    removeRoute(routeData) {
        const routeIndex = this.loadedRoutes.findIndex(route => route === routeData);
        if (routeIndex !== -1) {
            this.loadedRoutes.splice(routeIndex, 1);
        }
    }

    // 全ルートをクリア
    clearAllRoutes() {
        this.loadedRoutes = [];
    }

    // 同じ開始・終了ポイントを持つ既存ルートを検索
    findExistingRoute(startPoint, endPoint) {
        return this.loadedRoutes.find(route => {
            const routePoints = this.getRoutePoints(route);
            return routePoints.startPoint === startPoint && routePoints.endPoint === endPoint;
        });
    }
}