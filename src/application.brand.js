(function () {
    'use strict';
    angular.module('application.brand', ['config', 'toggle.edit.mode', 'i18n', 'image-management'])
        .directive('applicationBrand', ['$q', '$window', 'config', 'configReader', 'configWriter', 'i18n', 'editMode', 'editModeRenderer', 'imageManagement', ApplicationBrandDirective]);

    function ApplicationBrandDirective($q, $window, config, configReader, configWriter, i18n, editMode, editModeRenderer, imageManagement) {
        return {
            restrict: 'A',
            scope: true,
            link: function (scope, element) {
                configReader({
                    $scope: {},
                    scope: 'public',
                    key: 'application.brand.name.visible'
                }).then(function (result) {
                    scope.brandNameVisible = result.data.value == 'true';
                    scope.brandNameVisible ? resolveName(scope) : resolveLogoPath(scope);
                }, function () {
                    resolveLogoPath(scope);
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

                function open () {
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
                        template: '<form ng-submit="save()">' +
                        '<div class="bin-menu-edit-body">' +

                        '<div ng-show="working">' +
                            '<i class="fa fa-spinner fa-spin"></i> ' +
                            '<span i18n code="application.brand.{{workingState}}" read-only ng-bind="var"></span>' +
                        '</div>' +

                        '<table class="table" ng-hide="working">' +
                            '<tr>' +
                                '<th colspan="2" i18n code="application.brand.choose.one" read-only ng-bind="::var"></th>' +
                            '</tr>' +
                            '<tr ng-repeat="v in violations">' +
                                '<th colspan="2" class="text-danger" i18n code="upload.image.{{::v}}" default="{{::v}}" read-only>' +
                                    '<i class="fa fa-exclamation-triangle fa-fw"></i> {{::var}}' +
                                '</th>' +
                            '</tr>' +
                            '<tr ng-if="workingState == \'error\'">' +
                                '<th colspan="2" class="text-danger" i18n code="application.brand.error" read-only>' +
                                    '<i class="fa fa-exclamation-triangle fa-fw"></i> {{::var}}' +
                                '</th>' +
                            '</tr>' +
                            '<tr ng-class="{\'active\': choice == \'name\'}">' +
                                '<td style="width:90px; padding-top: 30px; padding-bottom: 30px;">' +
                                    '<input type="radio" name="applicationBrandRadios" id="applicationBrandName" ng-model="choice" value="name">' +
                                    '<label for="applicationBrandName"><span i18n code="application.brand.choice.name" read-only ng-bind="::var"></span></label>' +
                                '</td>' +
                                '<td>' +
                                    '<input type="text" class="form-control" ng-model="brandName" ng-disabled="choice != \'name\'">' +
                                '</td>' +
                            '</tr>' +
                            '<tr ng-class="{\'active\': choice == \'logo\'}">' +
                                '<td style="width:90px; padding-top: 30px; padding-bottom: 30px;">' +
                                    '<input type="radio" name="applicationBrandRadios" id="applicationBrandLogo" ng-model="choice" value="logo">' +
                                    '<label for="applicationBrandLogo"><span i18n code="application.brand.choice.logo" read-only ng-bind="::var"></span></label>' +
                                '</td>' +
                                '<td>' +
                                    '<div style="margin-top:15px;">' +
                                        '<img ng-src="{{logoSrc}}" style="max-width:160px; margin: 0 15px 15px 0;">' +
                                        '<button type="button" class="btn btn-default" ng-click="browseLogo()" ' +
                                            'i18n code="application.brand.browse.button" read-only ng-bind="::var" ' +
                                            'ng-show="choice == \'logo\'" style="margin: 0 15px 15px 0;">' +
                                        '</button>' +
                                    '</div>' +
                                '</td>' +
                            '</tr>' +
                        '</table>' +

                        '</div>' +
                        '<div class="bin-menu-edit-actions">' +
                        '<button type="submit" class="btn btn-primary" i18n code="clerk.menu.save.button" read-only ng-bind="::var"></button>' +
                        '<button type="button" class="btn btn-default" ng-click="close()" i18n code="clerk.menu.close.button" read-only ng-bind="::var"></button>' +
                        '</div>' +
                        '</form>',
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
})();