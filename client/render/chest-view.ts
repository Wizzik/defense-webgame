import { BoxGeometry, Group, Mesh, MeshStandardNodeMaterial, type PerspectiveCamera, Vector3 } from "three/webgpu";
import { chestPrice, type Run } from "../../sim";
import type { RunView } from "../game/session";
import { el, setText } from "../ui/dom";
import { SCENE_SCALE } from "./coords";

/** Blue-grey wood and a pale gold band: the game's palette, nothing orange. */
const BODY_COLOR = 0x8494b4;
const BAND_COLOR = 0xe8c860;
/** Height above the floor of the price label, in scene units. */
const LABEL_HEIGHT = 2.1;
/** The chest is about as wide as a hero is tall, so it reads from the game camera. */
const CHEST_SCALE = 1.8;

/**
 * The chests on the map: a box with a lid and a band each (procedural, no model) and a price label over it,
 * white when the hero has the gold and grey when not. `update` does not allocate.
 */
export class ChestView implements RunView {
  readonly object = new Group();
  /** Labels are hidden behind the menu. */
  labelsVisible = true;
  private readonly chests: Group[] = [];
  private readonly labels: HTMLElement[] = [];
  private readonly camera: PerspectiveCamera;
  private readonly parent: HTMLElement;
  private readonly point = new Vector3();
  private readonly body = new MeshStandardNodeMaterial({ color: BODY_COLOR, roughness: 0.8 });
  private readonly band = new MeshStandardNodeMaterial({ color: BAND_COLOR, emissive: BAND_COLOR, emissiveIntensity: 0.25, roughness: 0.4 });
  private readonly boxGeometry = new BoxGeometry(0.9, 0.5, 0.6);
  private readonly lidGeometry = new BoxGeometry(0.98, 0.2, 0.68);
  private readonly bandGeometry = new BoxGeometry(0.16, 0.74, 0.7);

  constructor(parent: HTMLElement, camera: PerspectiveCamera) {
    this.parent = parent;
    this.camera = camera;
  }

  private ensure(count: number): void {
    while (this.chests.length < count) {
      const chest = new Group();
      const box = new Mesh(this.boxGeometry, this.body);
      box.position.y = 0.25;
      const lid = new Mesh(this.lidGeometry, this.body);
      lid.position.y = 0.6;
      const band = new Mesh(this.bandGeometry, this.band);
      band.position.y = 0.36;
      for (const mesh of [box, lid, band]) mesh.castShadow = true;
      chest.add(box, lid, band);
      chest.scale.setScalar(CHEST_SCALE);
      this.object.add(chest);
      this.chests.push(chest);
      this.labels.push(el("div", "chest-label", this.parent));
    }
  }

  update(run: Run, _alpha: number, _dt: number): void {
    const { chests } = run;
    this.ensure(chests.x.length);
    const price = chestPrice(run);
    const afford = run.gold >= price;
    const text = String(price);
    const width = innerWidth;
    const height = innerHeight;
    this.camera.updateMatrixWorld();
    for (let i = 0; i < this.chests.length; i++) {
      const x = chests.x[i]! * SCENE_SCALE;
      const z = -chests.y[i]! * SCENE_SCALE;
      this.chests[i]!.position.set(x, 0, z);
      const label = this.labels[i]!;
      this.point.set(x, LABEL_HEIGHT, z).project(this.camera);
      // the labels would lie over the cards and the end screen
    const shown = this.labelsVisible && run.state === "playing" && this.point.z <= 1 && Math.abs(this.point.x) <= 1.1 && Math.abs(this.point.y) <= 1.1;
      label.hidden = !shown;
      if (!shown) continue;
      setText(label, text);
      label.classList.toggle("afford", afford);
      const px = (this.point.x * 0.5 + 0.5) * width;
      const py = (-this.point.y * 0.5 + 0.5) * height;
      label.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }

  dispose(): void {
    for (const label of this.labels) label.remove();
    this.body.dispose();
    this.band.dispose();
    this.boxGeometry.dispose();
    this.lidGeometry.dispose();
    this.bandGeometry.dispose();
  }
}
