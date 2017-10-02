(function () {
    'use strict';
    angular.module('application.brand', ['binarta-applicationjs-angular1', 'config', 'toggle.edit.mode', 'i18n', 'image-management'])
        .service('applicationBrand', ['$rootScope', '$q', '$window', 'binarta', 'config', 'i18n', 'imageManagement', 'editModeRenderer', 'configWriter', ApplicationBrandService])
        .directive('applicationBrand', ['$q', '$window', 'config', 'configWriter', 'i18n', 'editMode', 'editModeRenderer', 'imageManagement', 'binarta', ApplicationBrandDirective])
        .component('binBrand', new BinBrandComponent());

    function ApplicationBrandService($rootScope, $q, $window, binarta, config, i18n, imageManagement, editModeRenderer, configWriter) {
        var self = this;
        var configKey = 'application.brand.name.visible';
        var i18nKey = 'application.brand.name';
        var i18nArgs = {
            default: config.namespace,
            locale: 'default'
        };

        this.logoId = 'brand-logo.img';

        this.observeIsNameVisible = function (cb) {
            return binarta.application.config.observePublic(configKey, function (result) {
                cb(isTrue(result));
            });
        };

        this.observeBrandName = function (cb) {
            return i18n.observe(i18nKey, function (name) {
                cb(name);
            }, i18nArgs);
        };

        this.edit = function () {
            binarta.schedule(function () {
                var file;
                var rendererScope = $rootScope.$new();
                var initialChoice;

                binarta.application.config.findPublic(configKey, function (result) {
                    rendererScope.choice = isTrue(result) ? 'name' : 'logo';
                    initialChoice = rendererScope.choice;
                });

                i18n.resolve(angular.extend(i18nArgs, {code: i18nKey})).then(function (translation) {
                    rendererScope.brandName = translation;
                });

                imageManagement.getImagePath({
                    code: self.logoId,
                    height: 80
                }).then(function (result) {
                    rendererScope.logoSrc = result;
                });

                function isNameSelected() {
                    return rendererScope.choice === 'name';
                }

                function isLogoSelected() {
                    return rendererScope.choice === 'logo';
                }

                function isSelectedLogoValid() {
                    return file && rendererScope.violations && rendererScope.violations.length === 0;
                }

                function updateConfig() {
                    var deferred = $q.defer();

                    if (initialChoice !== rendererScope.choice) {
                        rendererScope.workingState = 'config.updating';

                        configWriter({
                            $scope: {},
                            scope: 'public',
                            key: configKey,
                            value: isNameSelected()
                        }).then(function () {
                            deferred.resolve();
                        }, function () {
                            deferred.reject();
                        });
                    } else {
                        deferred.resolve();
                    }

                    return deferred.promise;
                }

                function updateBrandName() {
                    var deferred = $q.defer();

                    if (isNameSelected()) {
                        rendererScope.workingState = 'name.updating';

                        i18n.translate({
                            code: i18nKey,
                            translation: rendererScope.brandName,
                            locale: 'default'
                        }).then(function () {
                            deferred.resolve();
                        }, function () {
                            deferred.reject();
                        });
                    } else {
                        deferred.resolve();
                    }

                    return deferred.promise;
                }

                function updateLogo() {
                    var deferred = $q.defer();

                    if (isLogoSelected() && isSelectedLogoValid()) {
                        rendererScope.workingState = 'logo.uploading';

                        imageManagement.upload({file: file, code: 'brand-logo.img'}).then(function () {
                            deferred.resolve();
                        }, function () {
                            deferred.reject();
                        });
                    } else {
                        deferred.resolve();
                    }

                    return deferred.promise;
                }

                rendererScope.save = function () {
                    rendererScope.working = true;
                    $q.all([
                        updateConfig(),
                        updateBrandName(),
                        updateLogo()
                    ]).then(function () {
                        rendererScope.close();
                    }, function () {
                        rendererScope.workingState = 'error';
                    }).finally(function () {
                        rendererScope.working = false;
                    });
                };

                rendererScope.browseLogo = function () {
                    if (isLogoSelected()) {
                        imageManagement.fileUpload({
                            dataType: 'json',
                            add: function (e, d) {
                                file = d;
                                rendererScope.violations = imageManagement.validate(d);
                                if (rendererScope.violations.length === 0) {
                                    if ($window.URL) rendererScope.logoSrc = $window.URL.createObjectURL(d.files[0]);
                                }
                                rendererScope.$digest();
                            }
                        }).click();
                    }
                };

                rendererScope.close = function () {
                    editModeRenderer.close();
                };

                editModeRenderer.open({
                    templateUrl: 'bin-application-brand-edit.html',
                    scope: rendererScope
                });
            });
        };

        function isTrue(input) {
            return (typeof input === 'boolean') ? input : input === 'true';
        }
    }

    function ApplicationBrandDirective($q, $window, config, configWriter, i18n, editMode, editModeRenderer, imageManagement, binarta) {
        return {
            restrict: 'A',
            scope: true,
            link: function (scope, element) {
                binarta.schedule(function () {
                    scope.$on('$destroy', binarta.application.config.observePublic('application.brand.name.visible', function (result) {
                        scope.brandNameVisible = result == 'true';
                        scope.brandNameVisible ? resolveName(scope) : resolveLogoPath(scope);
                    }).disconnect);
                });

                function resolveName(scope) {
                    i18n.resolve({
                        code: 'application.brand.name',
                        default: config.namespace,
                        locale: 'default'
                    }).then(function (translation) {
                        scope.brandName = translation;
                    }, function () {
                        scope.brandName = config.namespace;
                    });
                }

                function resolveLogoPath(scope) {
                    imageManagement.getImagePath({
                        code: 'brand-logo.img',
                        width: 200
                    }).then(function (result) {
                        scope.logoSrc = result;
                    });
                }

                function open() {
                    var file;
                    var rendererScope = scope.$new();
                    if (scope.brandNameVisible) {
                        rendererScope.choice = 'name';
                        rendererScope.brandName = scope.brandName;
                        resolveLogoPath(rendererScope);
                    } else {
                        rendererScope.choice = 'logo';
                        resolveName(rendererScope);
                        rendererScope.logoSrc = scope.logoSrc;
                    }

                    function isNameSelected() {
                        return rendererScope.choice == 'name';
                    }

                    function isLogoSelected() {
                        return rendererScope.choice == 'logo';
                    }

                    function isSelectedLogoValid() {
                        return file && rendererScope.violations && rendererScope.violations.length == 0;
                    }

                    function updateConfig() {
                        var deferred = $q.defer();

                        if (scope.brandNameVisible != isNameSelected()) {
                            rendererScope.workingState = 'config.updating';

                            configWriter({
                                $scope: {},
                                scope: 'public',
                                key: 'application.brand.name.visible',
                                value: isNameSelected()
                            }).then(function () {
                                deferred.resolve();
                            }, function () {
                                deferred.reject();
                            });
                        } else {
                            deferred.resolve();
                        }
                        return deferred.promise;
                    }

                    function updateBrandName() {
                        var deferred = $q.defer();

                        if (isNameSelected()) {
                            rendererScope.workingState = 'name.updating';

                            i18n.translate({
                                code: 'application.brand.name',
                                translation: rendererScope.brandName,
                                locale: 'default'
                            }).then(function () {
                                deferred.resolve();
                            }, function () {
                                deferred.reject();
                            });
                        } else {
                            deferred.resolve();
                        }

                        return deferred.promise;
                    }

                    function updateLogo() {
                        var deferred = $q.defer();

                        if (isLogoSelected() && isSelectedLogoValid()) {
                            rendererScope.workingState = 'logo.uploading';

                            imageManagement.upload({file: file, code: 'brand-logo.img'}).then(function () {
                                deferred.resolve();
                            }, function () {
                                deferred.reject();
                            });
                        } else {
                            deferred.resolve();
                        }

                        return deferred.promise;
                    }

                    rendererScope.save = function () {
                        rendererScope.working = true;
                        $q.all([
                            updateConfig(),
                            updateBrandName(),
                            updateLogo()
                        ]).then(function () {
                            scope.brandNameVisible = isNameSelected();
                            if (scope.brandNameVisible) scope.brandName = rendererScope.brandName;
                            else if (isSelectedLogoValid()) resolveLogoPath(scope);
                            else scope.logoSrc = rendererScope.logoSrc;
                            rendererScope.close();
                        }, function () {
                            rendererScope.workingState = 'error';
                        }).finally(function () {
                            rendererScope.working = false;
                        });
                    };

                    rendererScope.browseLogo = function () {
                        if (isLogoSelected()) {
                            imageManagement.fileUpload({
                                dataType: 'json',
                                add: function (e, d) {
                                    file = d;
                                    rendererScope.violations = imageManagement.validate(d);
                                    if (rendererScope.violations.length == 0) {
                                        if ($window.URL) rendererScope.logoSrc = $window.URL.createObjectURL(d.files[0]);
                                    }
                                    rendererScope.$digest();
                                }
                            }).click();
                        }
                    };

                    rendererScope.close = function () {
                        editModeRenderer.close();
                    };

                    editModeRenderer.open({
                        templateUrl: 'bin-application-brand-edit.html',
                        scope: rendererScope
                    });
                }

                editMode.bindEvent({
                    scope: scope,
                    element: element,
                    permission: 'config.store',
                    onClick: open
                });
            }
        };
    }

    function BinBrandComponent() {
        this.template = '<a bin-href="/" ng-style="::{minHeight: $ctrl.logoHeight + \'px\'}" ng-switch="$ctrl.isBrandNameVisible">' +
            '<div ng-style="::{height: $ctrl.logoHeight + \'px\'}" ng-switch-when="false">' +
            '<img bin-image="{{::$ctrl.logoId}}" read-only alt="{{$ctrl.brandName}}" height="{{::$ctrl.logoHeight}}" ' +
            'ng-style="::{maxHeight: $ctrl.logoHeight + \'px\'}">' +
            '</div>' +
            '<h1 ng-bind="$ctrl.brandName" ng-switch-when="true"></h1>' +
            '</a>';

        this.bindings = {
            logoHeight: '@'
        };

        this.controller = ['$scope', '$element', 'applicationBrand', 'editMode', function ($scope, $element, applicationBrand, editMode) {
            var $ctrl = this;
            var observers = [];

            $ctrl.$onInit = function () {
                $ctrl.logoId = applicationBrand.logoId;

                observers.push(applicationBrand.observeIsNameVisible(function (result) {
                    $ctrl.isBrandNameVisible = result;
                    $ctrl.isBrandNameVisible ? $element.addClass('name') : $element.removeClass('name');
                }));

                observers.push(applicationBrand.observeBrandName(function (name) {
                    $ctrl.brandName = name;
                }));

                editMode.bindEvent({
                    scope: $scope,
                    element: $element.find('a'),
                    permission: 'config.store',
                    onClick: applicationBrand.edit
                });
            };

            $ctrl.$onDestroy = function () {
                observers.forEach(function (observer) {
                    observer.disconnect();
                });
            }
        }];
    }
})();