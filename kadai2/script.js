var gl;
var canvas;
var legacygl;
var texture;
var mesh_control;
var mesh_subdiv;
var bbox;
var displist_control;
var displist_subdiv_faces;
var displist_subdiv_edges;
var drawutil;
var camera;

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!mesh_control) return;
    
    // projection and camera position
    var zmin = vec3.length(camera.eye_to_center()) * 0.01;
    var zmax = zmin * 10000;
    mat4.perspective(legacygl.uniforms.projectionMatrix.value, Math.PI / 6, canvas.aspect_ratio(), zmin, zmax);
    camera.lookAt(legacygl.uniforms.modelviewMatrix.value);
    mat3.fromMat4(legacygl.uniforms.normalMatrix.value, legacygl.uniforms.modelviewMatrix.value);
    mat3.invert_ip(legacygl.uniforms.normalMatrix.value);
    mat3.transpose_ip(legacygl.uniforms.normalMatrix.value);
    legacygl.uniforms.use_material.value = 0;
    
    // bounding box
    legacygl.uniforms.modelviewMatrix.push();
    mat4.translate_ip(legacygl.uniforms.modelviewMatrix.value, bbox.center());
    mat4.scale_ip(legacygl.uniforms.modelviewMatrix.value, bbox.diagonal());
    legacygl.color(0.5, 0.5, 0.5);
    drawutil.cube("line", 1);
    legacygl.uniforms.modelviewMatrix.pop();
    
    // control mesh
    if (document.getElementById("check_show_control").checked) {
        displist_control.draw(function(){
            legacygl.color(0, 0, 0.5);
            legacygl.begin(gl.LINES);
            mesh_control.edges_forEach(function(e){
                e.vertices().forEach(function(v){
                    legacygl.vertex3(v.point);
                });
            });
            legacygl.end();
        });
    }
    
    // subdiv mesh faces
    legacygl.uniforms.use_material.push();
    legacygl.uniforms.use_material.value = 1;
    displist_subdiv_faces.draw(function() {
        legacygl.begin(gl.TRIANGLES);
        mesh_subdiv.faces.forEach(function(f) {
            legacygl.normal3(f.normal);
            var vs  = f.vertices();
            for (var i = 1; i < vs.length-1; i++) {
                legacygl.vertex3(vs[0].point);
                legacygl.vertex3(vs[i].point);
                legacygl.vertex3(vs[i+1].point);
            }
        });
        legacygl.end();
    });
    legacygl.uniforms.use_material.pop();
    
    // subdiv mesh edges
    if (document.getElementById("check_show_edges").checked) {
        displist_subdiv_edges.draw(function() {
            legacygl.color(0, 0.5, 0.2);
            legacygl.begin(gl.LINES);
            mesh_subdiv.edges_forEach(function(e) {
                e.vertices().forEach(function(v) {
                    legacygl.vertex3(v.point);
                });
            });
            legacygl.end();
        });
    }
};
function subdivide(flag) {
    if (flag == 'loop') {
        // for each edge, compute subdivided point
        mesh_subdiv.edges_forEach(function(e){
            var v = e.vertices();
            var w = [e.halfedge.next.vertex, e.halfedge.opposite.next.vertex];
            if (e.is_boundary()) {
                e.subdiv_point = vec3.scale([], vec3.add([], v[0].point, v[1].point), 0.5);
            } else {
                e.subdiv_point = vec3.add([],
                    vec3.scale([], vec3.add([], v[0].point, v[1].point), 3 / 8),
                    vec3.scale([], vec3.add([], w[0].point, w[1].point), 1 / 8))
            }
        });
        // for each vertex, compute displaced point
        mesh_subdiv.vertices.forEach(function(v){
            if (v.is_boundary()) {
                var w0 = v.halfedge.prev.from_vertex();
                var w1 = v.halfedge.vertex;
                v.subdiv_point = vec3.add([],
                    vec3.scale([], v.point, 3 / 4),
                    vec3.scale([], vec3.add([], w0.point, w1.point), 1 / 8));
            } else {
                var w = v.vertices();
                var alpha = Math.pow(3 / 8 + 1 / 4 * Math.cos(2 * Math.PI / w.length), 2) + 3 / 8;
                v.subdiv_point = vec3.scale([], v.point, alpha);
                for (var i = 0; i < w.length; ++i)
                    v.subdiv_point = vec3.add([], v.subdiv_point, vec3.scale([], w[i].point, (1 - alpha) / w.length));
            }
        });
      
        // make next subdiv mesh topology
        var mesh_subdiv_next = make_halfedge_mesh();
        var offset = mesh_subdiv.num_vertices();
        mesh_subdiv.faces.forEach(function(f){
            f.halfedges().forEach(function(h){
                var fv_indices = [h.from_vertex().id];
                fv_indices.push(offset + h.edge.id);
                fv_indices.push(offset + h.prev.edge.id);
                mesh_subdiv_next.add_face(fv_indices);
            });
            var fv_indices = [];
            f.edges().forEach(function(e){
                fv_indices.push(offset + e.id);
            });
            mesh_subdiv_next.add_face(fv_indices);
        });
        // set geometry for the next subdiv mesh
        mesh_subdiv.vertices.forEach(function(v){
            mesh_subdiv_next.vertices[v.id].point = v.subdiv_point;
        });
        mesh_subdiv.edges_forEach(function(e){
            mesh_subdiv_next.vertices[offset + e.id].point = e.subdiv_point;
        });
    } else if (flag == 'doo') {
        mesh_subdiv.faces.forEach(function(f){
            var v = f.vertices();
            var fmid = vec3.scale([],v.reduce((a,b) => vec3.add([],a,b.point), [0,0,0]), 1 / v.length);            
            var vmid = [];
            for (var i = 0; i < v.length; i++) {
                vmid.push(vec3.scale([], vec3.add([], v[i].point, v[(i+1)%v.length].point), 1 / 2));
            }
            f.subdiv_points = [];
            for (var i = 0; i < v.length; i++) {
                f.subdiv_points.push(vec3.scale([], vec3.add([],
                    vec3.add([], v[i].point, fmid),
                    vec3.add([], vmid[(i+v.length-1)%v.length], vmid[i])), 1 / 4));
            }
        });

        // make next subdiv mesh topology
        var mesh_subdiv_next = make_halfedge_mesh();    
        var offsets = [0];
        mesh_subdiv.faces.forEach(function(f){
            offsets.push(offsets[f.id] + f.subdiv_points.length);
        });

        mesh_subdiv.faces.forEach(function(f){
            var offset = offsets[f.id];
            var fv_indices = [];
            for (var i = 0; i < f.subdiv_points.length; i++) {
              fv_indices.push(offset+i);
            }
            mesh_subdiv_next.add_face(fv_indices);
        });

        mesh_subdiv.edges_forEach(function(e){
            var fv_indices = [];
            e.halfedges().forEach(function(h){
                var hf = h.face;
                var i = hf.halfedges().indexOf(h);
                fv_indices.push(offsets[hf.id]+i, offsets[hf.id]+(i+hf.subdiv_points.length-1)%hf.subdiv_points.length);
            });
            mesh_subdiv_next.add_face(fv_indices);
        });

        mesh_subdiv.vertices.forEach(function(v){
            var fv_indices = [];
            v.faces().forEach(function(f){
                fv_indices.unshift(offsets[f.id]+f.vertices().indexOf(v));
            });
            mesh_subdiv_next.add_face(fv_indices);
        });

        var idx = 0;
        mesh_subdiv.faces.forEach(function(f){
            f.subdiv_points.forEach(function(v){
                mesh_subdiv_next.vertices[idx].point = v;
                idx++;
            });
        }); 
    } else if (flag == 'catmull') {
        mesh_subdiv.faces.forEach(function(f){
            f.subdiv_point = vec3.scale([],f.vertices().reduce((a,b) => vec3.add([],a,b.point), [0,0,0]), 1 / f.vertices().length);  
        });
        
        mesh_subdiv.edges_forEach(function(e){
            var gmid = vec3.scale([], e.halfedges().reduce((a,b) => vec3.add([],a,b.face.subdiv_point), [0,0,0]), 1 / 2);
            var mid = vec3.scale([], e.vertices().reduce((a,b) => vec3.add([],a,b.point), [0,0,0]), 1 / 2);
            e.subdiv_point = vec3.scale([], vec3.add([],gmid,mid), 1 / 2);
        });
      
        mesh_subdiv.vertices.forEach(function(v){
            var n = v.faces.length;
            var gmid = vec3.scale([], v.faces().reduce((a,b) => vec3.add([],a,b.subdiv_point), [0,0,0]), 1 / n**2);
            var mid = vec3.scale([], v.edges().reduce((a,b) => vec3.add([],a,b.subdiv_point), [0,0,0]), 2 / n**2);
            v.subdiv_point = vec3.scaleAndAdd_ip(vec3.add([], gmid, mid), v.point, (n-3) / n**2);
        });

        // make next subdiv mesh topology
        var mesh_subdiv_next = make_halfedge_mesh();    
        var offsete = mesh_subdiv.num_faces();
        var offsetv = offsete+mesh_subdiv.num_edges();

        mesh_subdiv.faces.forEach(function(f){
            console.log(f.halfedges());
            f.halfedges().forEach(function(h){
                var fv_indices = [f.id, offsete+h.edge.id, offsetv+h.vertex.id, offsete+h.next.edge.id];
                mesh_subdiv_next.add_face(fv_indices);
            });
        });
      
        mesh_subdiv.faces.forEach(function(f){
            mesh_subdiv_next.vertices[f.id].point = f.subdiv_point;
        });
      
        mesh_subdiv.edges_forEach(function(e){
            mesh_subdiv_next.vertices[offsete+e.id].point = e.subdiv_point;
        });
      
        mesh_subdiv.vertices.forEach(function(v){
            mesh_subdiv_next.vertices[offsetv+v.id].point = v.subdiv_point;
        });
      
        console.log(mesh_subdiv_next);

//         mesh_subdiv.edges_forEach(function(e){
//             var fv_indices = [];
//             e.halfedges().forEach(function(h){
//                 var hf = h.face;
//                 var i = hf.halfedges().indexOf(h);
//                 fv_indices.push(offsets[hf.id]+i, offsets[hf.id]+(i+hf.subdiv_points.length-1)%hf.subdiv_points.length);
//             });
//             mesh_subdiv_next.add_face(fv_indices);
//         });

        // mesh_subdiv.vertices.forEach(function(v){
        //     var fv_indices = [];
        //     v.faces().forEach(function(f){
        //         fv_indices.unshift(offsets[f.id]+f.vertices().indexOf(v));
        //     });
        //     mesh_subdiv_next.add_face(fv_indices);
        // });

        // mesh_subdiv.faces.forEach(function(f){
        //     f.subdiv_points.forEach(function(v){
        //         mesh_subdiv_next.vertices[idx].point = v;
        //         idx++;
        //     });
        // }); 
    }
                              
    mesh_subdiv = mesh_subdiv_next;
    mesh_subdiv.init_ids();
    mesh_subdiv.init_boundaries();
    mesh_subdiv.compute_normals();
    displist_subdiv_faces.invalidate();
    displist_subdiv_edges.invalidate();
    draw();
    document.getElementById("label_mesh_nv").innerHTML = mesh_subdiv.num_vertices();
    document.getElementById("label_mesh_nf").innerHTML = mesh_subdiv.num_faces();
    document.getElementById("label_mesh_ne").innerHTML = mesh_subdiv.num_edges();
};
function change_mesh() {
    if (document.getElementById("default1").checked) {
        init(1);
    } else if (document.getElementById("default2").checked) {
        init(2);
    }
    draw();
};
function write_mesh() {
    var filename = "mesh_subdiv.obj";
    var content = meshio.write(mesh_subdiv, filename);
    var myBlob = new Blob([content], { type: "octet/stream"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(myBlob);;
    a.download = filename;
    a.click();
}
function init(flag) {
    // OpenGL context
    canvas = document.getElementById("canvas");
    gl = canvas.getContext("experimental-webgl");
    if (!gl)
        alert("Could not initialize WebGL!");
    var vertex_shader_src = "\
        attribute vec3 a_vertex;\
        attribute vec3 a_color;\
        attribute vec3 a_normal;\
        varying vec3 v_normal;\
        varying vec3 v_color;\
        uniform mat4 u_modelviewMatrix;\
        uniform mat4 u_projectionMatrix;\
        uniform mat3 u_normalMatrix;\
        void main(void) {\
            gl_Position = u_projectionMatrix * u_modelviewMatrix * vec4(a_vertex, 1.0);\
            v_color = a_color;\
            v_normal = u_normalMatrix * a_normal;\
            gl_PointSize = 5.0;\
        }\
        ";
    var fragment_shader_src = "\
        precision mediump float;\
        uniform sampler2D u_texture;\
        uniform int u_use_material;\
        varying vec3 v_normal;\
        varying vec3 v_color;\
        void main(void) {\
            if (u_use_material == 1) {\
                vec3 nnormal = normalize(v_normal);\
                nnormal.y *= -1.0;\
                vec2 texcoord = nnormal.xy * 0.45 + vec2(0.5, 0.5);\
                gl_FragColor = texture2D(u_texture, texcoord);\
            } else {\
                gl_FragColor = vec4(v_color, 1.0);\
            }\
        }\
        ";
    legacygl = get_legacygl(gl, vertex_shader_src, fragment_shader_src);
    legacygl.add_uniform("modelviewMatrix", "Matrix4f");
    legacygl.add_uniform("projectionMatrix", "Matrix4f");
    legacygl.add_uniform("normalMatrix", "Matrix3f");
    legacygl.add_uniform("texture", "1i");
    legacygl.add_uniform("use_material", "1i");
    legacygl.add_vertex_attribute("color", 3);
    legacygl.add_vertex_attribute("normal", 3);
    legacygl.vertex3 = function(p) {
        this.vertex(p[0], p[1], p[2]);
    };
    legacygl.normal3 = function(n) {
        this.normal(n[0], n[1], n[2]);
    };
    displist_control = legacygl.displist_wrapper("control");
    displist_subdiv_faces = legacygl.displist_wrapper("subdiv_faces");
    displist_subdiv_edges = legacygl.displist_wrapper("subdiv_edges");
    drawutil = get_drawutil(gl, legacygl);
    camera = get_camera(canvas.width);
    // init OpenGL settings
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    gl.clearColor(1, 1, 1, 1);
    // init texture
    texture = gl.createTexture();
    // event handlers
    canvas.onmousedown = function(evt) {
        camera.start_moving(this.get_mousepos(evt), evt.shiftKey ? "zoom" : evt.ctrlKey ? "pan" : "rotate");
    };
    canvas.onmousemove = function(evt) {
        if (camera.is_moving()) {
            camera.move(this.get_mousepos(evt));
            draw();
        }
    };
    document.onmouseup = function(evt) {
        if (camera.is_moving())
            camera.finish_moving();
    };
    function read_mesh(filename, content) {
        var mesh_temp = meshio.read(filename, content);
        // var has_nontriangle = false;
        // for (var i = 0; i < mesh_temp.faces.length; ++i) {
        //     if (mesh_temp.faces[i].halfedges().length != 3) {
        //         has_nontriangle = true;
        //         break;
        //     }
        // }
        // if (has_nontriangle) {
        //     alert("Non-triangle polygon found! Please triangulate the mesh first.");
        //     return;
        // }
        mesh_control = mesh_subdiv = mesh_temp;
        mesh_subdiv.compute_normals();
        bbox = make_boundingbox();
        mesh_control.vertices.forEach(function(v) {
            bbox.extend(v.point);
        });
        camera.center = bbox.center();
        camera.eye = vec3.add([], camera.center, [0, 0, bbox.diagonal_norm() * 2]);
        camera.up = [0, 1, 0];
        displist_control.invalidate();
        displist_subdiv_faces.invalidate();
        displist_subdiv_edges.invalidate();
        draw();
        document.getElementById("label_mesh_nv").innerHTML = mesh_subdiv.num_vertices();
        document.getElementById("label_mesh_nf").innerHTML = mesh_subdiv.num_faces();
        document.getElementById("label_mesh_ne").innerHTML = mesh_subdiv.num_edges();
    };
    document.getElementById("text_mesh_disk").onchange = function() {
        if (this.files.length != 1) return;
        var file = this.files[0];
        if (!verify_filename_extension(file.name, [".obj", ".off"])) return;
        var reader = new FileReader();
        reader.onload = function() {
            read_mesh(file.name, this.result);
        };
        reader.readAsText(file);
    };
    function read_default_mesh(url) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onload = function() {
            if (this.status == 200)
                read_mesh(url, this.response);
        };
        xhr.send();
    };
    if (flag == 1) {
        read_default_mesh("https://cdn.glitch.com/d7a5350c-2fd9-452d-8711-e051480a63a6%2Fmesh_cube.obj?v=1588592855302");
    } else if (flag == 2) {
        read_default_mesh("https://cdn.glitch.com/d7a5350c-2fd9-452d-8711-e051480a63a6%2Fmesh_subdiv.obj?v=1588592862069");
    }
    // read_default_mesh("https://cdn.glitch.com/e530aeed-ec07-4e9a-b2b2-e5dd9fc39322%2Floop-test.obj?1556153350921");
    // texture
    function read_texture(dataurl) {
        var img = document.getElementById("img_material");
        img.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            displist_subdiv_faces.invalidate();
            draw();
        };
        img.crossOrigin = "anonymous";
        img.src = dataurl;
    };
    document.getElementById("text_material_disk").onchange = function() {
        if (this.files.length != 1) return;
        var file = this.files[0];
        if (!verify_filename_extension(file.name, [".png", ".jpg", ".gif"])) return;
        var reader = new FileReader();
        reader.onload = function() {
            read_texture(this.result);
        };
        reader.readAsDataURL(file);
    };
    function read_default_texture(url) {
        if (!verify_filename_extension(url, [".png", ".jpg", ".gif"])) return;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "blob";
        xhr.onload = function() {
            if (this.status == 200)
                read_texture(URL.createObjectURL(this.response));
        };
        xhr.send();
    };
    read_default_texture("https://cdn.glitch.com/13696316-44e5-40d1-b312-830e260e4817%2Fmetal1.png?1555562471905");
};