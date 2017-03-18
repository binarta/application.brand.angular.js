describe('application.pages', function () {
    var $window, $rootScope, $q, config, configReader, configWriter, editMode, editModeRenderer, i18n, imageManagement;
    var configReaderDeferred, configWriterDeferred, i18nResolveDeferred, i18nTranslateDeferred, getImagePathDeferred, uploadDeferred;
    var fileUploadClicked;
    var _file = {
        size: 2000,
        type: 'image/jpeg',
        name: 'name'
    };
    var validFile = {
        files: [_file]
    };

    angular.module('config', [])
        .value('config', {})
        .factory('configReader', ['$q', function ($q) {
            configReaderDeferred = $q.defer();
            return jasmine.createSpy('configReader').and.returnValue(configReaderDeferred.promise);
        }])
        .factory('configWriter', ['$q', function ($q) {
            configWriterDeferred = $q.defer();
            return jasmine.createSpy('configWriter').and.returnValue(configWriterDeferred.promise);
        }]);

    angular.module('toggle.edit.mode', [])
        .service('editModeRenderer', function () {
            return jasmine.createSpyObj('editModeRenderer', ['open', 'close']);
        })
        .service('editMode', function () {
            return jasmine.createSpyObj('editMode', ['bindEvent']);
        });

    angular.module('i18n', [])
        .service('i18n', ['$q', function ($q) {
            i18nResolveDeferred = $q.defer();
            i18nTranslateDeferred = $q.defer();

            this.resolve = jasmine.createSpy('translate').and.returnValue(i18nResolveDeferred.promise);
            this.translate = jasmine.createSpy('resolve').and.returnValue(i18nTranslateDeferred.promise);
        }]);

    angular.module('image-management', [])
        .service('imageManagement', ['$q', function ($q) {
            getImagePathDeferred = $q.defer();
            uploadDeferred = $q.defer();

            this.getImagePath = jasmine.createSpy('getImagePath').and.returnValue(getImagePathDeferred.promise);
            this.fileUpload = jasmine.createSpy('fileUpload').and.returnValue({
                click: function () {
                    fileUploadClicked = true;
                }
            });
            this.validate = jasmine.createSpy('validate');
            this.upload = jasmine.createSpy('upload').and.returnValue(uploadDeferred.promise);
        }]);

    beforeEach(module('application.brand'));

    beforeEach(inject(function (_$window_, _$rootScope_, _config_, _configReader_, _configWriter_, _editMode_, _editModeRenderer_,
                                _i18n_, _imageManagement_) {
        $window = _$window_;
        $rootScope = _$rootScope_;
        config = _config_;
        configReader = _configReader_;
        configWriter = _configWriter_;
        editMode = _editMode_;
        editModeRenderer = _editModeRenderer_;
        i18n = _i18n_;
        imageManagement = _imageManagement_;

        $window.URL = {
            createObjectURL: function (file) {
                $window.URL.createObjectURLSpy = file;
                return 'objectUrl';
            }
        };

        fileUploadClicked = false;
    }));

    describe('applicationBrand directive', function () {
        var scope, html, element;

        beforeEach(inject(function ($rootScope, $compile) {
            config.namespace = 'namespace';
            html = '<div application-brand></div>';
            element = angular.element(html);

            $compile(element)($rootScope.$new());
            scope = element.scope();
        }));

        it('bind edit mode', function () {
            expect(editMode.bindEvent).toHaveBeenCalledWith({
                scope: scope,
                element: element,
                permission: 'config.store',
                onClick: jasmine.any(Function)
            });
        });

        describe('when logo is visible', function () {
            beforeEach(function () {
                scope.brandNameVisible = false;
                scope.logoSrc = 'logo.img';
            });

            describe('on edit mode opened', function () {
                beforeEach(function () {
                    editMode.bindEvent.calls.first().args[0].onClick();
                });

                describe('with renderer scope', function () {
                    var rendererScope;

                    beforeEach(function () {
                        i18nResolveDeferred.resolve('brand name');
                        rendererScope = editModeRenderer.open.calls.first().args[0].scope;
                        scope.$digest();
                    });

                    it('logo path is on renderer scope', function () {
                        expect(rendererScope.logoSrc).toEqual('logo.img');
                    });

                    it('brand name is requested', function () {
                        expect(i18n.resolve).toHaveBeenCalledWith({
                            code: 'application.brand.name',
                            default: 'namespace',
                            locale: 'default'
                        });

                        i18nResolveDeferred.resolve('brand name');
                        rendererScope.$digest();

                        expect(rendererScope.brandName).toEqual('brand name');
                    });

                    it('choice is on rendererScope', function () {
                        expect(rendererScope.choice).toEqual('logo');
                    });

                    describe('on browse logo', function () {
                        beforeEach(function () {
                            rendererScope.browseLogo();
                        });

                        it('fileupload is triggered', function () {
                            expect(imageManagement.fileUpload).toHaveBeenCalledWith({
                                dataType: 'json',
                                add: jasmine.any(Function)
                            });

                            expect(fileUploadClicked).toBeTruthy();
                        });

                        describe('new valid logo is selected', function () {
                            beforeEach(function () {
                                imageManagement.validate.and.returnValue([]);

                                imageManagement.fileUpload.calls.first().args[0].add(null, validFile);
                            });

                            it('logo is validated', function () {
                                expect(imageManagement.validate).toHaveBeenCalledWith(validFile);
                            });

                            it('object url is on rendererScope', function () {
                                expect($window.URL.createObjectURLSpy).toEqual(_file);

                                expect(rendererScope.logoSrc).toEqual('objectUrl');
                            })
                        });

                        describe('new invalid logo is selected', function () {
                            beforeEach(function () {
                                imageManagement.validate.and.returnValue(['invalid']);

                                imageManagement.fileUpload.calls.first().args[0].add(null, {});
                            });

                            it('violations are on rendererScope', function () {
                                expect(rendererScope.violations).toEqual(['invalid']);
                            });

                            it('logo src is not changed', function () {
                                expect(rendererScope.logoSrc).toEqual('logo.img');
                            });
                        });
                    });

                    describe('on save and nothing changed', function () {
                        beforeEach(function () {
                            rendererScope.save();
                        });

                        it('system is in working state', function () {
                            expect(rendererScope.working).toBeTruthy();
                        });

                        it('config is not changed, no update required', function () {
                            expect(configWriter).not.toHaveBeenCalled();
                        });

                        it('brand name is not changed, no update required', function () {
                            expect(i18n.translate).not.toHaveBeenCalled();
                        });

                        it('logo is not changed, no update required', function () {
                            expect(imageManagement.upload).not.toHaveBeenCalled();
                        });

                        it('when done, close renderer', function () {
                            rendererScope.$digest();

                            expect(editModeRenderer.close).toHaveBeenCalled();
                        });
                    });

                    describe('on save and logo changed', function () {
                        beforeEach(function () {
                            rendererScope.browseLogo();
                            imageManagement.validate.and.returnValue([]);
                            imageManagement.fileUpload.calls.first().args[0].add(null, validFile);

                            rendererScope.save();
                        });

                        it('system is in working state', function () {
                            expect(rendererScope.working).toBeTruthy();
                        });

                        it('config is not changed, no update required', function () {
                            expect(configWriter).not.toHaveBeenCalled();
                        });

                        it('brand name is not changed, no update required', function () {
                            expect(i18n.translate).not.toHaveBeenCalled();
                        });

                        describe('update logo', function () {
                            it('set working state', function () {
                                expect(rendererScope.workingState).toEqual('logo.uploading');
                            });

                            it('upload image', function () {
                                expect(imageManagement.upload).toHaveBeenCalledWith({
                                    file: jasmine.any(Object),
                                    code: 'brand-logo.img'
                                });
                            });

                            describe('when upload fails', function () {
                                beforeEach(function () {
                                    uploadDeferred.reject();
                                    rendererScope.$digest();
                                });

                                it('set violation', function () {
                                    expect(rendererScope.workingState).toEqual('error');
                                });

                                it('disable working state', function () {
                                    expect(rendererScope.working).toBeFalsy();
                                });

                                it('renderer is not closed', function () {
                                    expect(editModeRenderer.close).not.toHaveBeenCalled();
                                });
                            });

                            describe('when upload succeeds', function () {
                                beforeEach(function () {
                                    getImagePathDeferred.resolve('new image path');
                                    uploadDeferred.resolve();
                                    rendererScope.$digest();
                                });

                                it('update logo src on scope', function () {
                                    expect(scope.logoSrc).toEqual('new image path');
                                });

                                it('close renderer', function () {
                                    expect(editModeRenderer.close).toHaveBeenCalled();
                                });
                            });
                        });
                    });
                });
            });
        });

        describe('when brand name is visible', function () {
            beforeEach(function () {
                scope.brandNameVisible = true;
                scope.brandName = 'app';
            });

            describe('on edit mode opened', function () {
                beforeEach(function () {
                    editMode.bindEvent.calls.first().args[0].onClick();
                });

                it('edit mode renderer is opened', function () {
                    expect(editModeRenderer.open).toHaveBeenCalledWith({
                        template: jasmine.any(String),
                        scope: jasmine.any(Object)
                    });
                });

                describe('with renderer scope', function () {
                    var rendererScope;

                    beforeEach(function () {
                        i18nResolveDeferred.resolve('brand name');
                        rendererScope = editModeRenderer.open.calls.first().args[0].scope;
                        scope.$digest();
                    });

                    it('brand name is on renderer scope', function () {
                        expect(rendererScope.brandName).toEqual('app');
                    });

                    it('logo path is requested', function () {
                        expect(imageManagement.getImagePath).toHaveBeenCalledWith({
                            code: 'brand-logo.img',
                            width: 200
                        });

                        getImagePathDeferred.resolve('logo-path');
                        rendererScope.$digest();

                        expect(rendererScope.logoSrc).toEqual('logo-path');
                    });

                    it('choice is on rendererScope', function () {
                        expect(rendererScope.choice).toEqual('name');
                    });

                    describe('on browse logo', function () {
                        beforeEach(function () {
                            rendererScope.browseLogo();
                        });

                        it('fileupload is not triggered', function () {
                            expect(imageManagement.fileUpload).not.toHaveBeenCalled();
                            expect(fileUploadClicked).toBeFalsy();
                        });
                    });

                    describe('on save and brand name is changed', function () {
                        beforeEach(function () {
                            rendererScope.brandName = 'new brand name';
                            rendererScope.save();
                        });

                        it('set working state', function () {
                            expect(rendererScope.workingState).toEqual('name.updating');
                        });

                        it('config is not changed, no update required', function () {
                            expect(configWriter).not.toHaveBeenCalled();
                        });

                        it('logo is not changed, no update required', function () {
                            expect(imageManagement.upload).not.toHaveBeenCalled();
                        });

                        it('brand name is updated', function () {
                            expect(i18n.translate).toHaveBeenCalledWith({
                                code: 'application.brand.name',
                                translation: 'new brand name',
                                locale: 'default'
                            });
                        });

                        describe('when update fails', function () {
                            beforeEach(function () {
                                i18nTranslateDeferred.reject();
                                rendererScope.$digest();
                            });

                            it('set violation', function () {
                                expect(rendererScope.workingState).toEqual('error');
                            });

                            it('disable working state', function () {
                                expect(rendererScope.working).toBeFalsy();
                            });

                            it('renderer is not closed', function () {
                                expect(editModeRenderer.close).not.toHaveBeenCalled();
                            });
                        });

                        describe('when update succeeds', function () {
                            beforeEach(function () {
                                i18nTranslateDeferred.resolve();
                                rendererScope.$digest();
                            });

                            it('update brand name on scope', function () {
                                expect(scope.brandName).toEqual('new brand name');
                            });

                            it('close renderer', function () {
                                expect(editModeRenderer.close).toHaveBeenCalled();
                            });
                        });
                    });

                    describe('on save and config is changed', function () {
                        beforeEach(function () {
                            getImagePathDeferred.resolve('logo-path');
                            rendererScope.choice = 'logo';
                            rendererScope.save();
                        });

                        it('set working state', function () {
                            expect(rendererScope.workingState).toEqual('config.updating');
                        });

                        it('logo is not changed, no update required', function () {
                            expect(imageManagement.upload).not.toHaveBeenCalled();
                        });

                        it('brand name is not changed, no update required', function () {
                            expect(i18n.translate).not.toHaveBeenCalled();
                        });

                        it('config is updated', function () {
                            expect(configWriter).toHaveBeenCalledWith({
                                $scope: {},
                                scope: 'public',
                                key: 'application.brand.name.visible',
                                value: false
                            });
                        });

                        describe('when update fails', function () {
                            beforeEach(function () {
                                configWriterDeferred.reject();
                                rendererScope.$digest();
                            });

                            it('set violation', function () {
                                expect(rendererScope.workingState).toEqual('error');
                            });

                            it('disable working state', function () {
                                expect(rendererScope.working).toBeFalsy();
                            });

                            it('renderer is not closed', function () {
                                expect(editModeRenderer.close).not.toHaveBeenCalled();
                            });
                        });

                        describe('when update succeeds', function () {
                            beforeEach(function () {
                                configWriterDeferred.resolve();
                                rendererScope.$digest();
                            });

                            it('update scope', function () {
                                expect(scope.brandNameVisible).toEqual(false);
                                expect(scope.logoSrc).toEqual('logo-path');
                            });

                            it('close renderer', function () {
                                expect(editModeRenderer.close).toHaveBeenCalled();
                            });
                        });
                    });

                    it('on close', function () {
                        rendererScope.close();

                        expect(editModeRenderer.close).toHaveBeenCalled();
                    });
                });
            });
        });
    });
});