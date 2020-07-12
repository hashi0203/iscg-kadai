var gl;
var canvas;
var legacygl;
var drawutil;
var camera;
var linkages = [
  { angle : 0, length : 0.8 },
  { angle : 0, length : 0.9 },
  { angle : 0, length : 1.5 },
  { angle : 0, length : 0.7 },
];
var is_dragging = false;

function update_position() {
  linkages.forEach(function(linkage, index){
    linkage.position = [0, 0];
    var angle_sum = 0;
    for (var j = 0; j <= index; ++j) {
      angle_sum += linkages[j].angle;
      linkage.position[0] += linkages[j].length * Math.cos(angle_sum * Math.PI / 180);
      linkage.position[1] += linkages[j].length * Math.sin(angle_sum * Math.PI / 180);
    }
  });
};

function compute_ik(target_position) {
  // TODO
  target_position = [target_position[0],target_position[1]];
  var end_position;
  var base_position;
  var angle_diff = 100;
  while (angle_diff > 1) {
    var current_angle = linkages.reduce((sum,linkage) => sum + linkage.angle);
    linkages.slice().reverse().forEach(function(linkage, index){
      end_position = linkages[linkages.length-1].position;
      base_position = (index == linkages.length - 1 ? [0,0] : linkages[linkages.length-index-2].position);
      var v1 = vec2.create();
      var v2 = vec2.create();
      vec2.sub(v1,end_position,base_position);
      vec2.sub(v2,target_position,base_position);
      var angle = Math.acos(vec2.dot(v1,v2)/(vec2.length(v1)*vec2.length(v2))) * 180/Math.PI;
      var sign = Math.sign(v1[0] * v2[1] - v1[1] * v2[0]);
      linkage.angle += sign * angle;
      update_position();
    });
    angle_diff = Math.abs(linkages.reduce((sum,linkage) => sum + linkage.angle) - current_angle)/linkages.length;
  }
  // console.log(linkages[0].angle, linkages[1].angle, linkages[2].angle, linkages[3].angle);
};

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // projection & camera position
  mat4.perspective(legacygl.uniforms.projection.value, Math.PI / 6, canvas.aspect_ratio(), 0.1, 1000);
  var modelview = legacygl.uniforms.modelview;
  camera.lookAt(modelview.value);
  
  // xy grid
  gl.lineWidth(1);
  legacygl.color(0.5, 0.5, 0.5);
  drawutil.xygrid(100);
  
  // linkages
  var selected = Number(document.getElementById("input_selected").value);
  legacygl.begin(gl.LINES);
  linkages.forEach(function(linkage, index){
    if (index == selected)
      legacygl.color(1, 0, 0);
    else
      legacygl.color(0, 0, 0);
    if (index == 0)
      legacygl.vertex(0, 0, 0);
    else
      legacygl.vertex2(linkages[index - 1].position);
    legacygl.vertex2(linkage.position);
  });
  legacygl.end();
  legacygl.begin(gl.POINTS);
  legacygl.color(0, 0, 0);
  legacygl.vertex(0, 0, 0);
  linkages.forEach(function(linkage, index){
    if (index == selected)
      legacygl.color(1, 0, 0);
    else
      legacygl.color(0, 0, 0);
    legacygl.vertex2(linkage.position);
  });
  legacygl.end();
};
function init() {
  // OpenGL context
  canvas = document.getElementById("canvas");
  gl = canvas.getContext("experimental-webgl");
  if (!gl)
    alert("Could not initialise WebGL, sorry :-(");
  var vertex_shader_src = "\
    attribute vec3 a_vertex;\
    attribute vec3 a_color;\
    varying vec3 v_color;\
    uniform mat4 u_modelview;\
    uniform mat4 u_projection;\
    void main(void) {\
      gl_Position = u_projection * u_modelview * vec4(a_vertex, 1.0);\
      v_color = a_color;\
      gl_PointSize = 5.0;\
    }\
    ";
  var fragment_shader_src = "\
    precision mediump float;\
    varying vec3 v_color;\
    void main(void) {\
      gl_FragColor = vec4(v_color, 1.0);\
    }\
    ";
  legacygl = get_legacygl(gl, vertex_shader_src, fragment_shader_src);
  legacygl.add_uniform("modelview", "Matrix4f");
  legacygl.add_uniform("projection", "Matrix4f");
  legacygl.add_vertex_attribute("color", 3);
  legacygl.vertex2 = function(p) {
    this.vertex(p[0], p[1], 0);
  };
  drawutil = get_drawutil(gl, legacygl);
  camera = get_camera(canvas.width);
  camera.center = [2, 0, 0];
  camera.eye = [2, 0, 7];
  update_position();
  // event handlers
  canvas.onmousedown = function(evt) {
    var mouse_win = this.get_mousepos(evt);
    if (evt.altKey) {
      camera.start_moving(mouse_win, evt.shiftKey ? "zoom" : "pan");
      return;
    }
    if (document.getElementById("input_ikmode").checked)
      is_dragging = true;
  };
  canvas.onmousemove = function(evt) {
    var mouse_win = this.get_mousepos(evt);
    if (camera.is_moving()) {
      camera.move(mouse_win);
      draw();
      return;
    }
    if (!is_dragging) return;
    var viewport = [0, 0, canvas.width, canvas.height];
    mouse_win.push(1);
    var mouse_obj = glu.unproject(mouse_win, 
                    legacygl.uniforms.modelview.value,
                    legacygl.uniforms.projection.value,
                    viewport);
    // just reuse the same code as the 3D case
    var plane_origin = [0, 0, 0];
    var plane_normal = [0, 0, 1];
    var eye_to_mouse = vec3.sub([], mouse_obj, camera.eye);
    var eye_to_origin = vec3.sub([], plane_origin, camera.eye);
    var s1 = vec3.dot(eye_to_mouse, plane_normal);
    var s2 = vec3.dot(eye_to_origin, plane_normal);
    var eye_to_intersection = vec3.scale([], eye_to_mouse, s2 / s1);
    var target_position = vec3.add([], camera.eye, eye_to_intersection);
    compute_ik(target_position);
    draw();
    document.getElementById("input_selected").onchange();
  }
  document.onmouseup = function (evt) {
    if (camera.is_moving()) {
      camera.finish_moving();
      return;
    }
    is_dragging = false;
  };
  document.getElementById("input_selected").max = linkages.length - 1;
  document.getElementById("input_selected").onchange = function(){
    document.getElementById("input_angle").value = linkages[this.value].angle;
    draw();
  };
  document.getElementById("input_angle").onchange = function(){
    var selected = document.getElementById("input_selected").value;
    linkages[selected].angle = Number(document.getElementById("input_angle").value);
    update_position();
    draw();
  };
  // init OpenGL settings
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1, 1, 1, 1);
};