import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';

// --- Typing Effect ---
const typedTextSpan = document.getElementById('typed-text');
const cursorSpan = document.querySelector('.typed-cursor');
const toType = ["Organize", "Create", "Share", "Visualize"];
let typeIndex = 0;
let charIndex = 0;
let isDeleting = false;

function type() {
  const currentWord = toType[typeIndex];
  
  if (isDeleting) {
    typedTextSpan.textContent = currentWord.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typedTextSpan.textContent = currentWord.substring(0, charIndex + 1);
    charIndex++;
  }

  if (!isDeleting && charIndex === currentWord.length) {
    isDeleting = true;
    setTimeout(type, 2000); // Pause at end of word
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    typeIndex = (typeIndex + 1) % toType.length;
    setTimeout(type, 500); // Pause before typing next word
  } else {
    setTimeout(type, isDeleting ? 100 : 200);
  }
}

if (typedTextSpan) {
  type();
}


// --- 3D Background (Stars) ---
const starsContainer = document.getElementById('stars-container');
if (starsContainer) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  starsContainer.appendChild(renderer.domElement);

  // Create Stars
  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = 5000;
  const posArray = new Float32Array(starsCount * 3);

  for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 5; // Spread stars
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const starsMaterial = new THREE.PointsMaterial({
    size: 0.002,
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
  });

  const starMesh = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starMesh);

  camera.position.z = 1;

  function animateStars() {
    requestAnimationFrame(animateStars);
    starMesh.rotation.y -= 0.0002;
    starMesh.rotation.x -= 0.0001;
    renderer.render(scene, camera);
  }
  animateStars();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}


// --- Hero 3D Object (Abstract Tech Shape) ---
const heroContainer = document.getElementById('hero-3d');

if (heroContainer) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, heroContainer.clientWidth / heroContainer.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  
  renderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
  heroContainer.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const pointLight = new THREE.PointLight(0x915EFF, 1);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0xffffff, 0.5);
  pointLight2.position.set(-5, -5, 5);
  scene.add(pointLight2);

  // Group for rotation
  const group = new THREE.Group();
  scene.add(group);

  // Central Icosahedron
  const geometry = new THREE.IcosahedronGeometry(1.5, 0);
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x151030, 
    roughness: 0.3,
    metalness: 0.8,
    wireframe: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Wireframe Overlay
  const wireGeo = new THREE.IcosahedronGeometry(1.51, 0);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x915EFF, wireframe: true });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  group.add(wireMesh);

  // Floating Particles Ring
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 200;
  const posArray = new Float32Array(particlesCount * 3);

  for(let i = 0; i < particlesCount * 3; i++) {
    // Create a ring shape
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.5 + Math.random() * 0.5;
    posArray[i] = Math.cos(angle) * radius;     // x
    posArray[i+1] = (Math.random() - 0.5) * 1;  // y (flattened)
    posArray[i+2] = Math.sin(angle) * radius;   // z
  }

  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.03,
    color: 0x915EFF
  });
  const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
  group.add(particlesMesh);

  camera.position.z = 5;

  // Mouse Interaction
  let mouseX = 0;
  let mouseY = 0;
  let targetRotationX = 0;
  let targetRotationY = 0;

  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - window.innerWidth / 2) / 100;
    mouseY = (event.clientY - window.innerHeight / 2) / 100;
  });

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Smooth rotation towards mouse
    targetRotationX = mouseY * 0.5;
    targetRotationY = mouseX * 0.5;

    group.rotation.x += 0.05 * (targetRotationX - group.rotation.x);
    group.rotation.y += 0.05 * (targetRotationY - group.rotation.y);

    // Constant idle rotation
    mesh.rotation.y += 0.005;
    wireMesh.rotation.y += 0.005;
    particlesMesh.rotation.y -= 0.002;
    
    // Gentle floating
    group.position.y = Math.sin(Date.now() * 0.001) * 0.2;

    renderer.render(scene, camera);
  }

  animate();

  // Handle Resize
  window.addEventListener('resize', () => {
    camera.aspect = heroContainer.clientWidth / heroContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
  });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});


