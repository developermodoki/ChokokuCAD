import {chokokuPath, setPrevPathFromChokokuPath} from './pathCanvas.js';
import {flagNotSaved} from './domEvents.js';
import {statuses} from './status.js';
import {camera, toScreenXY, model, faceNormals, faceColors, initFaceBuffer, scene, updateModel} from './renderer.js';
import {screenWidth, screenHeight, statusBar} from './gui.js';
import {i18n, language} from './i18n.js';
import {recordModel} from './undo.js';
let lockObject;
let chokokuHole;

export function updateLockObject(mesh) {
  scene.remove(lockObject);
  lockObject = mesh;
  if (mesh) {
    lockObject.visible = true;
    scene.add(lockObject);
  }
  flagNotSaved(true);
}

export function setModelFromChokoku() {
  // 決定
  if (chokokuPath.segments !== undefined && chokokuPath.segments.length <= 2) {
    statusBar.innerHTML = '<span style="color: #ff0000;">頂点は３つ以上用意する必要があります。</span>';
    setTimeout(function() {
      if (language === 'ja') {
        statusBar.textContent = `[${statuses[status].name}] ${statuses[status].desc}`;
      } else {
        statusBar.textContent = `[${status}] ${statuses[status].descEn}`;
      }
    }, 1000);
    return;
  }
  statuses['setpath'].change();
  let pathShape = new THREE.Shape();
  let originI = 0;
  for (let i = 0; i < chokokuPath.curves.length; i++) {
    let screenVec = toScreenXY(new THREE.Vector2(
      chokokuPath.curves[i].point1.x, chokokuPath.curves[i].point1.y
    ));
    if (
      i === 0 ||
      (chokokuPath.curves[i].point1.x === chokokuPath.curves[i - 1].point2.x &&
      chokokuPath.curves[i].point1.y === chokokuPath.curves[i - 1].point2.y)
    ) {
      if (pathShape.currentPoint.x === 0 && pathShape.currentPoint.y === 0) {
        pathShape.moveTo(
          screenVec.x * ((screenWidth - 330) / 7) / camera.zoom,
          screenVec.y * (screenHeight / 7) / camera.zoom
        );
      } else {
        pathShape.lineTo(
          screenVec.x * ((screenWidth - 330) / 7) / camera.zoom,
          screenVec.y * (screenHeight / 7) / camera.zoom
        );
      }
    } else {
      // moveTo (Three.jsのmoveToはうまく行かなかったので、その代わりにunion)
      screenVec = toScreenXY(new THREE.Vector2(
        chokokuPath.curves[originI].point1.x, chokokuPath.curves[originI].point1.y
      ));
      pathShape.lineTo(
        screenVec.x * ((screenWidth - 330) / 7) / camera.zoom,
        screenVec.y * (screenHeight / 7) / camera.zoom
      );
      originI = i;
      chokokuHole = createNewMeshFromPath(chokokuHole, pathShape);
      pathShape = new THREE.Shape();
    }
  }
  // moveTo (Three.jsのmoveToはうまく行かなかったので、その代わりにunion)
  let screenVec = toScreenXY(new THREE.Vector2(
    chokokuPath.curves[originI].point1.x, chokokuPath.curves[originI].point1.y
  ));
  pathShape.lineTo(
    screenVec.x * ((screenWidth - 330) / 7) / camera.zoom,
    screenVec.y * (screenHeight / 7) / camera.zoom
  );
  chokokuHole = createNewMeshFromPath(chokokuHole, pathShape);
  let chokokuHoleBSP; // ThreeBSPインスタンス
  let modelBSP; // ThreeBSPインスタンス
  let resultModel;
  try {
    chokokuHoleBSP = new ThreeBSP(chokokuHole) // ThreeBSPインスタンス
    modelBSP = new ThreeBSP(model) // ThreeBSPインスタンス
    const isEraser = document.querySelector('#chokoku-setting-eraser-btn').classList.contains('selected');
    if (document.querySelector('#chokoku-setting-lock-btn').classList.contains('selected')) { // Lock tool
      let lockObjectBSP;
      if (lockObject === undefined || lockObject.geometry.faces.length == 0) { // If first lock
        if (!isEraser) {
          lockObjectBSP = modelBSP.intersect(chokokuHoleBSP);
        }
      } else {
        lockObjectBSP = new ThreeBSP(lockObject);
        if (isEraser) {
          lockObjectBSP = lockObjectBSP.subtract(chokokuHoleBSP);
        } else {
          lockObjectBSP = lockObjectBSP.union(modelBSP.intersect(chokokuHoleBSP));
        }
      }
      scene.remove(lockObject);
      lockObject = lockObjectBSP.toMesh(new THREE.MeshPhongMaterial({
        color: 0xff0000,
        depthTest: false,
        transparent: true,
        opacity: 0.6
      }));
      scene.add(lockObject);
    } else { // Chokoku tool
      let resultModelBSP;
      if (isEraser) {
        resultModelBSP = modelBSP.subtract(chokokuHoleBSP);
      } else {
        resultModelBSP = modelBSP.intersect(chokokuHoleBSP);
      }
      if (lockObject === undefined || lockObject.geometry.faces.length == 0) {
        resultModel = resultModelBSP.toMesh(model.material);
      } else {
        let lockObjectBSP = new ThreeBSP(lockObject);
        resultModel = resultModelBSP.union(lockObjectBSP).toMesh(model.material);
      }
    }
    recordModel();

    // Set model
    if (document.querySelector('#chokoku-setting-chokoku-btn').classList.contains('selected')) { // Chokoku tool
      // ------- create face group by finding same fame normals -------

      let oldFaceNormals = [...faceNormals];
      let oldFaceColors = [...faceColors];
      initFaceBuffer();
      for (let i = 0;i < resultModel.geometry.faces.length;i++) {
        let faceNormal = resultModel.geometry.faces[i].normal;
        let materialIndex;
        let sameNormalIndex = findSameNormal(faceNormals, faceNormal);
        if (sameNormalIndex !== null) {
          materialIndex = sameNormalIndex;
        } else {
          let oldNormalIndex = findSameNormal(oldFaceNormals, faceNormal);
          faceNormals.push(faceNormal);
          faceColors.push(oldNormalIndex === null ? '#ffffff' : oldFaceColors[oldNormalIndex]);
          materialIndex = faceNormals.length - 1;
        }
        resultModel.geometry.faces[i].materialIndex = materialIndex;
        resultModel.geometry.faces[i].color.set(faceColors[materialIndex]);
      }
      updateModel(resultModel);
    }
  } catch (error) {
    statusBar.innerHTML = `<span style='color: #ff0000;'>${i18n('エラーが発生しました。', 'An error has occurred.')}</span>`;
    setTimeout(function() {
      if (language === 'ja') {
        statusBar.textContent = `[${statuses[status].name}] ${statuses[status].desc}`;
      } else {
        statusBar.textContent = `[${status}] ${statuses[status].descEn}`;
      }
    }, 1000);
    console.log(error);
  }
  chokokuHole = undefined;
  setPrevPathFromChokokuPath();
  document.querySelector('#reuse-btn').textContent = i18n('一つ前のパスを使用', 'Use previous path');
  document.querySelector('#reuse-btn').classList.remove('disabled');
}

function createNewMeshFromPath(chokokuHole, pathShape) {
  const nowPath3dLen = 300;
  let nowPath3d = new THREE.Mesh(
    new THREE.ExtrudeGeometry(pathShape, {
      bevelEnabled: false,
      amount: nowPath3dLen
    }),
    new THREE.MeshStandardMaterial({color: 0xffffff, wireframe: true})
  );
  nowPath3d.position.copy(camera.position.clone().setLength(nowPath3dLen / 2).negate());
  nowPath3d.lookAt(camera.position);
  chokokuHole = nowPath3d;
  return chokokuHole;
}

function findSameNormal(normals, normal) {
  for (let i = 0; i < normals.length; i++) {
    if (isSameNormal(normals[i], normal)) return i;
  }
  return null;
}

function isSameNormal(normal1, normal2) {
  return +normal1.x.toFixed(3) === +normal2.x.toFixed(3) &&
    +normal1.y.toFixed(3) === +normal2.y.toFixed(3) &&
    +normal1.z.toFixed(3) === +normal2.z.toFixed(3);
}

export {lockObject};