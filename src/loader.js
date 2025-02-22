import {model, scene, updateModel, startRender, removeMesh} from './renderer.js'
import {hideStartModal} from './gui.js';
import {statuses} from './status.js';

let uploadModel;
function onReaderLoad(reader, fileName) {
  return new Promise(function (resolve) {
    reader.addEventListener('load', function () {
      let uploadModelJSON;
      if (new RegExp('([^\s]+(\\.stl)$)', 'i').test(fileName)) {
        let stlBlob = reader.result;
        let STLLoader = new THREE.STLLoader();
        STLLoader.load(stlBlob, function (modelGeometry) {
          uploadModel = new THREE.Mesh(
            modelGeometry,
            new THREE.MeshStandardMaterial(model.material)
          );
          uploadModelJSON = uploadModel.toJSON();
          resolve(uploadModelJSON);
        }, function () { }, function () {
          alert(i18n('エラーが発生しました。', 'An error has occurred.'));
        });
      } else if (new RegExp('([^\s]+(\\.(glb|gltf))$)', 'i').test(fileName)) {
        let GLTFLoader = new THREE.GLTFLoader();
        let gltfBlob = reader.result;
        GLTFLoader.load(gltfBlob, function (arg) {
          uploadModel = arg.scene.children[0];
          if (uploadModel.geometry === undefined) {
            alert(i18n('申し訳ありませんが、このファイルには対応していません。\n代わりにSTL形式でアップロードしてみてください。', 'Sorry, this file format is not supported. \nPlease uploading in STL format instead.'));
          } else {
            uploadModelJSON = uploadModel.toJSON();
          }
          resolve(uploadModelJSON);
        }, function () { }, function (uploadError) {
          alert(i18n('エラーが発生しました。', 'An error has occurred'));
          console.log(uploadError);
        })
      } else {
        alert(i18n('ファイル形式が無効です（.glb, .gltf, .stlのみ）', 'The file format is not supported.(.glb, .gltf, .stl are supported.)'));
      }
    });
  });
}

export function loader(element, fileName) {
  let reader = new FileReader();
  reader.readAsDataURL(element.files[0]);
  return onReaderLoad(reader, fileName);
}

export function transformUploadModel() {
  uploadModel.position.set(
    document.querySelector('#new-model-position-x').value,
    document.querySelector('#new-model-position-y').value,
    document.querySelector('#new-model-position-z').value
  );
  uploadModel.rotation.set(
    THREE.Math.degToRad(document.querySelector('#new-model-rotation-x').value),
    THREE.Math.degToRad(document.querySelector('#new-model-rotation-y').value),
    THREE.Math.degToRad(document.querySelector('#new-model-rotation-z').value)
  );
  uploadModel.scale.set(
    document.querySelector('#new-model-scale-x').value,
    document.querySelector('#new-model-scale-y').value,
    document.querySelector('#new-model-scale-z').value
  );
}

export function setUploadModel(JSONData, isAdd = false) {
  let JSONLoader = new THREE.ObjectLoader();
  let dataBlob = 'data:application/json,' + encodeURIComponent(JSON.stringify(JSONData));
  JSONLoader.load(dataBlob, function(mesh) {
    if (isAdd) {
      uploadModel = mesh.clone();
      let uploadModelPosition = uploadModel.position;
      let uploadModelRotation = uploadModel.rotation;
      let uploadModelScale = uploadModel.scale;
      ['x', 'y', 'z'].forEach(xyz => {
        document.querySelector(`#new-model-position-${xyz}`).value = uploadModelPosition[xyz];
        document.querySelector(`#new-model-rotation-${xyz}`).value = uploadModelRotation[xyz];
        document.querySelector(`#new-model-scale-${xyz}`).value = uploadModelScale[xyz];
      });
      if (uploadModel.geometry.type === 'BufferGeometry') {
        let modelGeometry = new THREE.Geometry();
        let modelMaterial = uploadModel.material;
        // modelMaterial.depthTest = false;
        model.material.vertexColors = THREE.FaceColors;
        modelGeometry.fromBufferGeometry(uploadModel.geometry);
        uploadModel = new THREE.Mesh(
          modelGeometry,
          modelMaterial
        );
      }
      uploadModel.scale.set(...uploadModelScale.toArray());
      uploadModel.position.set(...uploadModelPosition.toArray());
      uploadModel.rotation.set(...uploadModelRotation.toArray());
      scene.add(uploadModel);
      document.querySelector('#file-upload-add-step1').classList.add('hidden');
      document.querySelector('#file-upload-add-step2').classList.remove('hidden');
      statuses['modelAdd2'].change();
    } else {
      updateModel(mesh.clone());
      if (model.geometry.type === 'BufferGeometry') {
        let modelGeometry = new THREE.Geometry();
        let modelMaterial = model.material;
        model.material.vertexColors = THREE.FaceColors;
        modelGeometry.fromBufferGeometry(model.geometry);
        updateModel(new THREE.Mesh(modelGeometry, modelMaterial));
      }
      scene.add(model);
      hideStartModal();

      document.querySelector('#model-color-btn').style.background = document.querySelector('#model-color').value;
    
      // Start main loop
      startRender();
    }
  });
}

export function unionToModel() {
  let uploadModelBSP = new ThreeBSP(uploadModel);
  let modelBSP = new ThreeBSP(model);
  let newModelBSP = modelBSP.union(uploadModelBSP);
  let newModel = newModelBSP.toMesh(model.material);
  removeMesh(model);
  model.visible = false;
  updateModel(newModel.clone());

  model.material.vertexColors = THREE.FaceColors;
}