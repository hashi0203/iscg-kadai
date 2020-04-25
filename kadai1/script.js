var gl;
var canvas;
var legacygl;
var drawutil;
var camera;
var p = Array(16);
var num_p = 3;
var w = Array(10);
var selected = null;
var flag = 0;

function comb(n,r) {
  var ret = 1;
  for (var i = 1; i <= r; i++) {
    ret *= n--;
    ret /= i;
  }
  return ret;
};
  
function eval_quadratic_bezier_normal(p, t, num_p, w) {
  var r;
  var c;
  var tmp;
  var sum = 0;
  var ans = [0,0,0];
  for (var i = 0; i < num_p; i+=2) {
    r = i/2;
    c = comb(num_p-1,r);
    tmp = w[i]*c*t**r*(1-t)**(num_p-1-r);
    sum += tmp;
    ans = vec3.scaleAndAdd_ip(ans,p[i],tmp);
    if (i != num_p-1) {
      tmp = w[i+1]*c*t**(num_p-1-r)*(1-t)**r;
      sum += tmp
      ans = vec3.scaleAndAdd_ip(ans,p[i+1],tmp);
    }
  }
  ans = vec3.scale([], ans, 1/sum);
  return ans;
};
  
function eval_quadratic_bezier_casteljau(p, t, num_p) {
  var points = Array(num_p);
  var idx = 0;
  for (var i = 0; i < num_p; i+=2){
    points[idx] = p[i];
    idx++;
  }
  for (var i = num_p-num_p%2-1; i > 0; i-=2){
    points[idx] = p[i];
    idx++;
  }
  for (var i = 0; i < num_p-1; i++) {
    for (var j = 0; j < idx-1; j++){
      points[j] = vec3.scaleAndAdd_ip(vec3.scale([],points[j],1-t),points[j+1],t);
    }
    idx--;
  }
  return points[0];
}
  
function eval_quadratic_bezier(p, t, num_p, flag, w) {
  if (flag == 0) {
    legacygl.vertex3(eval_quadratic_bezier_normal(p, t, num_p, w));
  } else if (flag == 1) {
    legacygl.vertex3(eval_quadratic_bezier_casteljau(p, t, num_p));
  }
};

function draw_bezier() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // projection & camera position
    mat4.perspective(legacygl.uniforms.projection.value, Math.PI / 6, canvas.aspect_ratio(), 0.1, 1000);
    var modelview = legacygl.uniforms.modelview;
    camera.lookAt(modelview.value);
    
    // xy grid
    gl.lineWidth(1);
    legacygl.color(0.5, 0.5, 0.5);
    drawutil.xygrid(100);
  
    var num_p = Number(document.getElementById("input_b_numcontrolpoints").value);
    if (num_p < 3) {
      num_p = 3;
      document.getElementById("input_b_numcontrolpoints").value = 3;
    } else if (num_p > 10) {
      num_p = 10;
      document.getElementById("input_b_numcontrolpoints").value = 10;
    } else {
      num_p = Math.round(num_p);
      document.getElementById("input_b_numcontrolpoints").value = num_p;
    }
    
    for (var i = 0; i < num_p; i++) {
      document.getElementById("label_rational"+i).style.display = 'inline-block';
    }
    for (var i = num_p; i < 10; i++) {
      document.getElementById("label_rational"+i).style.display = 'none';
    }
  
    for (var i = 0; i < num_p/2; i++) {
      var i2 = 2*i;
      w[i2] = Number(document.getElementById("input_rational"+i).value);
      if (i2 != num_p-1) {
        w[i2+1] = Number(document.getElementById("input_rational"+(num_p-i-1)).value);
      }
    }
  
    if (document.getElementById("input_evalnormal").checked) {
      flag = 0;
      document.getElementById("row_rational").style.display = 'table-row';
      legacygl.color(1, 0.6, 0.3);
    }else if (document.getElementById("input_evalcasteljau").checked) {
      flag = 1;
      document.getElementById("row_rational").style.display = 'none';
      legacygl.color(1, 0.6, 0.7);
    }
    
    // draw line segments composing curve
    var numsteps = Number(document.getElementById("input_numsteps").value);
    if (numsteps < 2) {
      numsteps = 2;
      document.getElementById("input_numsteps").value = 2;
    } else {
      numsteps = Math.round(numsteps);
      document.getElementById("input_numsteps").value = numsteps;
    }
  
    legacygl.begin(gl.LINE_STRIP);
    for (var i = 0; i <= numsteps; ++i) {
        var t = i / numsteps;
        eval_quadratic_bezier(p, t, num_p, flag, w);
    }
    legacygl.end();
    // draw sample points
    if (document.getElementById("input_show_samplepoints").checked) {
        legacygl.begin(gl.POINTS);
        for (var i = 0; i <= numsteps; ++i) {
            var t = i / numsteps;
            eval_quadratic_bezier(p, t, num_p, flag, w);
        }
        legacygl.end();
    }
    
    // draw division point
    if (document.getElementById("input_divide_curve").checked) {
        document.getElementById("row_divisionrate").style.display = 'table-row';
        var divrate = Number(document.getElementById("input_ratedivision").value);
        if (divrate < 0) {
            divrate = 0;
            document.getElementById("input_ratedivision").value = 0;
        } else if (divrate > 1) {
            divrate = 1;
            document.getElementById("input_ratedivision").value = 1;
        }
        legacygl.color(0.5, 0.2, 0.2);
        legacygl.begin(gl.LINE_STRIP);
        for (var t = 0; t < divrate; t+= 1/numsteps) {
            eval_quadratic_bezier(p, t, num_p, flag, w);
        }
        eval_quadratic_bezier(p, divrate, num_p, flag, w);
        legacygl.end();
        // draw sample points
        if (document.getElementById("input_show_samplepoints").checked) {
            legacygl.begin(gl.POINTS);
            for (var t = 0; t < divrate; t+= 1/numsteps) {
                eval_quadratic_bezier(p, t, num_p, flag, w);
            }
            eval_quadratic_bezier(p, divrate, num_p, flag, w);
            legacygl.end();
        }
    } else {
        document.getElementById("row_divisionrate").style.display = 'none';
    }
  
    // draw control points
    if (document.getElementById("input_show_controlpoints").checked) {
        legacygl.color(0.2, 0.5, 1);
        legacygl.begin(gl.LINE_STRIP);
        for (var i = 0; i < num_p; i+=2){
          legacygl.vertex3(p[i]);
        }
        for (var i = num_p-num_p%2-1; i > 0; i-=2){
          legacygl.vertex3(p[i]);
        }
        legacygl.end();
        legacygl.begin(gl.POINTS);
        for (var i = 0; i < num_p; i+=2){
          legacygl.vertex3(p[i]);
        }
        for (var i = num_p-num_p%2-1; i > 0; i-=2){
          legacygl.vertex3(p[i]);
        }
        legacygl.end();
    }
};

function get_coefs(p, num_p, knot) {
  var ret = Array(num_p-3);
  for (var j = 0; j < num_p-3; j++) {
      var ans = [];
      var a;
      var b;
      var c;
      var tmp;
      for (var i = 0; i < 3; i++) {
        a = vec3.scaleAndAdd_ip(vec3.scale([],p[j+i+1],1), p[j+i], -1);
        tmp = 1/(knot[j][i+1] - knot[j][i]);
        ans.push([vec3.scale([],a,tmp), vec3.scaleAndAdd_ip(vec3.scale([],p[j+i],1),a,-knot[j][i]*tmp)]);
      }
      for (var i = 0; i < 2; i++) {
        a = vec3.scaleAndAdd_ip(vec3.scale([],ans[i+1][0],1), ans[i][0], -1);
        b = vec3.scaleAndAdd_ip(vec3.scale([],ans[i+1][1],1), ans[i][1], -1);
        tmp = 1/(knot[j][i+2] - knot[j][i]);;
        ans[i] = [vec3.scale([],a,tmp),vec3.scaleAndAdd_ip(vec3.scale([],ans[i][0],1),vec3.scaleAndAdd_ip(vec3.scale([],b,1),a, -knot[j][i]),tmp),vec3.scaleAndAdd_ip(vec3.scale([],ans[i][1],1),b, -knot[j][i]*tmp)];
      }
      for (var i = 0; i < 1; i++) {
        a = vec3.scaleAndAdd_ip(vec3.scale([],ans[i+1][0],1), ans[i][0], -1);
        b = vec3.scaleAndAdd_ip(vec3.scale([],ans[i+1][1],1), ans[i][1], -1);
        c = vec3.scaleAndAdd_ip(vec3.scale([],ans[i+1][2],1), ans[i][2], -1);
        tmp = 1/(knot[j][i+2] - knot[j][i+1]);
        ret[j] = [vec3.scale([],a,tmp),vec3.scaleAndAdd_ip(vec3.scale([],ans[i][0],1),vec3.scaleAndAdd_ip(vec3.scale([],b,1),a, -knot[j][i+1]),tmp),vec3.scaleAndAdd_ip(vec3.scale([],ans[i][1],1),vec3.scaleAndAdd_ip(vec3.scale([],c,1),b, -knot[j][i+1]),tmp),vec3.scaleAndAdd_ip(vec3.scale([],ans[i][2],1),c,-knot[j][i+1]*tmp)];
      }
  }
  return ret;
};

function init_data_catmull() {
    if (num_p < 3) {
      num_p = 3;
      document.getElementById("input_c_numcontrolpoints").value = 3;
    } else if (num_p > 10) {
      num_p = 10;
      document.getElementById("input_c_numcontrolpoints").value = 10;
    } else {
      num_p = Math.round(num_p);
      document.getElementById("input_c_numcontrolpoints").value = num_p;
    }
    for (var i = 0; i < num_p; i++) {
      p[i] = [Number(document.getElementById("input_controlpoints_x"+i).value), Number(document.getElementById("input_controlpoints_y"+i).value),0];
    }
}

function draw_catmull() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // projection & camera position
    mat4.perspective(legacygl.uniforms.projection.value, Math.PI / 6, canvas.aspect_ratio(), 0.1, 1000);
    var modelview = legacygl.uniforms.modelview;
    camera.lookAt(modelview.value);
    
    // xy grid
    gl.lineWidth(1);
    legacygl.color(0.5, 0.5, 0.5);
    drawutil.xygrid(100);
  
    var num_p = Number(document.getElementById("input_c_numcontrolpoints").value);
    if (num_p < 3) {
      num_p = 3;
      document.getElementById("input_c_numcontrolpoints").value = 3;
    } else if (num_p > 10) {
      num_p = 10;
      document.getElementById("input_c_numcontrolpoints").value = 10;
    } else {
      num_p = Math.round(num_p);
      document.getElementById("input_c_numcontrolpoints").value = num_p;
    }
    // num_p = tmp_num_p;
    var tmp_p = Array(10);
    // for (var i = 0; i < num_p; i++) {
    //   tmp_p[i] = [Number(document.getElementById("input_controlpoints_x"+i).value), Number(document.getElementById("input_controlpoints_y"+i).value),0];
    // }
    for (var i = 0; i < num_p; i++) {
      tmp_p[i] = p[i];
    }
    tmp_p.sort((a, b) => a[0] - b[0]);
    for (var i = 0; i < num_p; i++){
        p[i] = tmp_p[i];
    }
    for (var i = 0; i < num_p-1; i++) {
      if (p[i][0] == p[i+1][0]) {
        p[i+1][0] += 0.1;
      } else if (p[i][0] == p[i+1][0]+0.1) {
        p[i+1][0] += 0.2;
      } else if (p[i][0] == p[i+1][0]+0.2) {
        p[i+1][0] += 0.3;
      } else if (p[i][0] > p[i+1][0]) {
        var tmp = p[i];
        p[i] = p[i+1];
        p[i+1] = tmp;
      }
    }
    
    for (var i = 0; i < num_p; i++) {
      document.getElementById("label_controlpoints"+i).style.display = 'inline-block';
      document.getElementById("input_controlpoints_x"+i).value = p[i][0];
      document.getElementById("input_controlpoints_y"+i).value = p[i][1];
    }
    for (var i = num_p; i < 10; i++) {
      document.getElementById("label_controlpoints"+i).style.display = 'none';
    }
    var knot = Array(num_p-3);
    var tmp = Array(4);
    tmp[0] = 0;
    if (document.getElementById("input_evaluniform").checked) {
      for (var i = 0; i < num_p-3; i++) {
        for (var j = 1; j < 4; j++) {
           tmp[j] = tmp[j-1]+1; 
        }
        knot[i] = tmp;
      }
      legacygl.color(1, 0.6, 0.7);
    }else if (document.getElementById("input_evalchordal").checked) {
      for (var i = 0; i < num_p-3; i++) {
        for (var j = 1; j < 4; j++) {
           tmp[j] = tmp[j-1]+Math.abs(p[j-1][0]-p[j][0]); 
        }
        knot[i] = tmp;
      }
      legacygl.color(0.1, 0.8, 0.5);
    }else if (document.getElementById("input_evalcentripetal").checked) {
      for (var i = 0; i < num_p-3; i++) {
        for (var j = 1; j < 4; j++) {
           tmp[j] = tmp[j-1]+Math.sqrt(Math.abs(p[j-1][0]-p[j][0])); 
        }
        knot[i] = tmp;
      }
      legacygl.color(0.5, 0.2, 1);
    }
    
    // draw line segments composing curve
    var numsteps = Number(document.getElementById("input_numsteps").value);
    if (numsteps < 2) {
      numsteps = 2;
      document.getElementById("input_numsteps").value = 2;
    } else {
      numsteps = Math.round(numsteps);
      document.getElementById("input_numsteps").value = numsteps;
    }
  
    var coefs = get_coefs(p, num_p, knot);
    each_numsteps = Math.ceil(numsteps/(num_p-3));
    legacygl.begin(gl.LINE_STRIP);
    for (var j = 0; j < num_p - 3; j++) {
        for (var i = 0; i <= each_numsteps; ++i) {
          var t = (knot[j][2]-knot[j][1]) * i / each_numsteps + knot[j][1];
          legacygl.vertex3(vec3.scaleAndAdd_ip(vec3.scale([],coefs[j][0],t**3), vec3.scaleAndAdd_ip(vec3.scale([],coefs[j][1],t**2),vec3.scaleAndAdd_ip(vec3.scale([],coefs[j][2],t),coefs[j][3],1),1),1));
        }
    }  
    legacygl.end();
    // draw sample points
    if (document.getElementById("input_show_samplepoints").checked) {
        legacygl.begin(gl.POINTS);
        for (var j = 0; j < num_p - 3; j++) {
            for (var i = 0; i <= each_numsteps; ++i) {
              var t = (knot[j][2]-knot[j][1]) * i / each_numsteps + knot[j][1];
              legacygl.vertex3(vec3.scaleAndAdd_ip(vec3.scale([],coefs[j][0],t**3), vec3.scaleAndAdd_ip(vec3.scale([],coefs[j][1],t**2),vec3.scaleAndAdd_ip(vec3.scale([],coefs[j][2],t),coefs[j][3],1),1),1));
            }
        } 
        legacygl.end();
    }
  
    // draw control points
    if (document.getElementById("input_show_controlpoints").checked) {
        legacygl.color(0.2, 0.5, 1);
        legacygl.begin(gl.LINE_STRIP);
        for (var i = 0; i < num_p; i++){
          legacygl.vertex3(p[i]);
        }
        legacygl.end();
        legacygl.begin(gl.POINTS);
        for (var i = 0; i < num_p; i++){
          legacygl.vertex3(p[i]);
        }
        legacygl.end();
    }
};

function eval_3dbezier(p, s, t) {
  var c1;
  var c2;
  var tmp;
  var ans = [0,0,0];
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++){
      c1 = comb(3,i);
      c2 = comb(3,j);
      tmp = (c1*s**i*(1-s)**(3-i)*(c2*t**j*(1-t)**(3-j)));
      ans = vec3.scaleAndAdd_ip(ans,p[4*i+j],tmp);
    }
  }
  return ans;
};

function draw_3dbezier(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // projection & camera position
    mat4.perspective(legacygl.uniforms.projection.value, Math.PI / 6, canvas.aspect_ratio(), 0.1, 1000);
    var modelview = legacygl.uniforms.modelview;
    camera.lookAt(modelview.value);
    // zx-grid
    legacygl.color(0.5, 0.5, 0.5);
    drawutil.zxgrid(50);
  
    num_p = 16;
    for (var i = 0; i < num_p; i++) {
      p[i] = [Number(document.getElementById("input_3dcontrolpoints_x"+i).value), Number(document.getElementById("input_3dcontrolpoints_y"+i).value), Number(document.getElementById("input_3dcontrolpoints_z"+i).value)];
    }
  
    if (document.getElementById("input_show_controlpoints").checked) {
      for (var i = 0; i <  4; i++) {
          legacygl.begin(gl.LINE_STRIP);
          legacygl.color(0.2, 0.5, 0.8);
          for (var j = 0; j < 4; j++) {
            legacygl.vertex3(p[4*i+j]);
          }
          legacygl.end();
      }  
      for (var i = 0; i <  4; i++) {
          legacygl.begin(gl.LINE_STRIP);
          legacygl.color(0.7, 0, 0.4);
          for (var j = 0; j < 4; j++) {
            legacygl.vertex3(p[4*j+i]);
          }
          legacygl.end();
      }  
      legacygl.begin(gl.POINTS);
      legacygl.color(0.2, 0.5, 1);
        for (var i = 0; i<  num_p; i++) {
          legacygl.vertex3(p[i]);
        } 
      legacygl.end();
    }
  
    var numsteps = Number(document.getElementById("input_numsteps").value);
    if (numsteps < 2) {
      numsteps = 2;
      document.getElementById("input_numsteps").value = 2;
    } else {
      numsteps = Math.round(numsteps);
      document.getElementById("input_numsteps").value = numsteps;
    }
  
    var step = 1/numsteps;
    var points = Array((numsteps+1)**2);
    for (var i = 0; i <= numsteps; i++) {
        for (var j = 0; j <= numsteps; j++) {
          points[(numsteps+1)*i+j] = eval_3dbezier(p, i*step, j*step);
        }
    }
    
    legacygl.begin(gl.LINE_STRIP);
    legacygl.color(0, 0, 0);
    for (var i = 0; i <= numsteps; i++) {
      legacygl.vertex3(points[i]);
    }
    for (var i = 0; i <= numsteps; i++) {
      legacygl.vertex3(points[(numsteps+1)*i+numsteps]);
    }
    for (var i = numsteps; i >= 0; i--) {
      legacygl.vertex3(points[(numsteps+1)*numsteps+i]);
    }
    for (var i = numsteps; i >= 0; i--) {
      legacygl.vertex3(points[(numsteps+1)*i]);
    }
    legacygl.end();
  
    legacygl.begin(legacygl.QUADS);
    legacygl.color(0.6, 0, 0.8);
    for (var i = 0; i < numsteps; i++) {
      for (var j = 0; j < numsteps; j++) {
          legacygl.vertex3(points[(numsteps+1)*i+j]);
          legacygl.vertex3(points[(numsteps+1)*i+j+1]);
          legacygl.vertex3(points[(numsteps+1)*(i+1)+j+1]);
          legacygl.vertex3(points[(numsteps+1)*(i+1)+j]);
      }
    }
    legacygl.end();
    if (document.getElementById("input_show_samplepoints").checked) {
        legacygl.begin(gl.POINTS);
        legacygl.color(0.4, 0.4, 0.5);
        for (var i = 0; i <= numsteps; i++) {
            for (var j = 0; j <= numsteps; j++) {
              legacygl.vertex3(points[(numsteps+1)*i+j]);
            }
        } 
        legacygl.end();
    }
    
    for (var i = 0; i < numsteps; i++) {
      legacygl.begin(gl.LINE_STRIP);
      legacygl.color(0.4, 0.4, 0.5);
      for (var j = 0; j <= numsteps; j++) {
        legacygl.vertex3(points[(numsteps+1)*i+j])
      }
      legacygl.end();
      legacygl.begin(gl.LINE_STRIP);
      legacygl.color(0.4, 0.4, 0.5);
      for (var j = 0; j <= numsteps; j++) {
        legacygl.vertex3(points[(numsteps+1)*j+i])
      }
      legacygl.end();
    }
};

function perimeter(l,p,t) {
  var tmp = Array(10);
  for (var i = 0; i < 10; i++) {
    tmp[i] = 1;
  }
  if (l == 0){ // c0
    return eval_quadratic_bezier_normal([p[0],p[3],p[1],p[2]], t, 4, tmp);
  } else if (l == 1){ // d1
    return eval_quadratic_bezier_normal([p[3],p[6],p[4],p[5]], t, 4, tmp);
  } else if (l == 2){ // c1
    return eval_quadratic_bezier_normal([p[9],p[6],p[8],p[7]], t, 4, tmp);
  } else if (l == 3){ // d0
    return eval_quadratic_bezier_normal([p[0],p[9],p[11],p[10]], t, 4, tmp);
  }
};

function draw_3dcoons(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // projection & camera position
    mat4.perspective(legacygl.uniforms.projection.value, Math.PI / 6, canvas.aspect_ratio(), 0.1, 1000);
    var modelview = legacygl.uniforms.modelview;
    camera.lookAt(modelview.value);
    // zx-grid
    legacygl.color(0.5, 0.5, 0.5);
    drawutil.zxgrid(50);
  
    num_p = 12;
    for (var i = 0; i < num_p; i++) {
      p[i] = [Number(document.getElementById("input_3dcontrolpoints_x"+i).value), Number(document.getElementById("input_3dcontrolpoints_y"+i).value), Number(document.getElementById("input_3dcontrolpoints_z"+i).value)];
    }
  
    var numsteps = Number(document.getElementById("input_numsteps").value);
    if (numsteps < 2) {
      numsteps = 2;
      document.getElementById("input_numsteps").value = 2;
    } else {
      numsteps = Math.round(numsteps);
      document.getElementById("input_numsteps").value = numsteps;
    }
    
    var step = 1/numsteps;
    var peri = Array(4);
    for (var i = 0; i < 4; i++) {
        peri[i] = Array(numsteps+1);
    }
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j <= numsteps; j++) {
          peri[i][j] = perimeter(i,p,j*step);
      }
    }
  
    for (var i = 0; i < 4; i++) {
      legacygl.begin(gl.LINE_STRIP);
      legacygl.color(0,0,0);
      for (var j = 0; j <= numsteps; j++) {
          var t = i / numsteps;
          legacygl.vertex3(peri[i][j]);
      }
      legacygl.end();
    }
  
    if (document.getElementById("input_show_controlpoints").checked) {
      legacygl.begin(gl.LINE_STRIP);
      for (var i = 0; i <= num_p; i++) {
          if (i <= num_p/4 || (i > num_p/2 && i <= 3*num_p/4)) {
            legacygl.color(0.2, 0.5, 0.8)
          }else{
            legacygl.color(0.7, 0, 0.4);
          }
          legacygl.vertex3(p[i%12]);
      }
      legacygl.end();
      legacygl.begin(gl.POINTS);
      legacygl.color(0.2, 0.5, 1);
        for (var i = 0; i <  num_p; i++) {
          legacygl.vertex3(p[i]);
        } 
      legacygl.end();
    }
  
    
    var points = Array((numsteps+1)**2);
    var s;
    var t;
    var lc;
    var ld;
    var b;
    for (var i = 0; i <= numsteps; i++) {
      for (var j = 0; j <= numsteps; j++) {
        s = i*step;
        t = j*step;
        lc = vec3.scaleAndAdd_ip(vec3.scale([],peri[0][i],(1-t)),peri[2][i],t);
        ld = vec3.scaleAndAdd_ip(vec3.scale([],peri[3][j],(1-s)),peri[1][j],s);
        b = vec3.scaleAndAdd_ip(vec3.scale([],peri[0][0],(1-s)*(1-t)),vec3.scaleAndAdd_ip(vec3.scale([],peri[0][numsteps],s*(1-t)), vec3.scaleAndAdd_ip(vec3.scale([],peri[2][0],(1-s)*t),peri[2][numsteps],s*t),1),1);
        points[(numsteps+1)*i+j] = vec3.scaleAndAdd_ip(vec3.scale([],lc,1), vec3.scaleAndAdd_ip(vec3.scale([],ld,1),b,-1),1);
      }
    }
  
    legacygl.begin(legacygl.QUADS);
    legacygl.color(0.6, 0, 0.8);
    for (var i = 0; i < numsteps; i++) {
      for (var j = 0; j < numsteps; j++) {
          legacygl.vertex3(points[(numsteps+1)*i+j]);
          legacygl.vertex3(points[(numsteps+1)*i+j+1]);
          legacygl.vertex3(points[(numsteps+1)*(i+1)+j+1]);
          legacygl.vertex3(points[(numsteps+1)*(i+1)+j]);
      }
    }
    legacygl.end();
  
    if (document.getElementById("input_show_samplepoints").checked) {
        legacygl.begin(gl.POINTS);
        legacygl.color(0.4, 0.4, 0.5);
        for (var i = 0; i <= numsteps; i++) {
            for (var j = 0; j <= numsteps; j++) {
              legacygl.vertex3(points[(numsteps+1)*i+j]);
            }
        } 
        legacygl.end();
    }
  
    for (var i = 0; i < numsteps; i++) {
      legacygl.begin(gl.LINE_STRIP);
      legacygl.color(0.4, 0.4, 0.5);
      for (var j = 0; j <= numsteps; j++) {
        legacygl.vertex3(points[(numsteps+1)*i+j])
      }
      legacygl.end();
      legacygl.begin(gl.LINE_STRIP);
      legacygl.color(0.4, 0.4, 0.5);
      for (var j = 0; j <= numsteps; j++) {
        legacygl.vertex3(points[(numsteps+1)*j+i])
      }
      legacygl.end();
    }
}

function draw() {
  if (document.getElementById("input_catmull").checked) {
    draw_catmull();
  } else if (document.getElementById("input_3dbezier").checked) {
    draw_3dbezier();
  } else if (document.getElementById("input_3dcoons").checked) {
    draw_3dcoons();
  } else {
    draw_bezier();
  }
};

function settings() {
  var hide_elements = [];
  var show_elements = [];
  if (document.getElementById("input_catmull").checked) {
    p = [[-1, 0.8, 0], [1, 1.1, 0], [0.6, 0.5, 0], [1.7, -1.5, 0], [-0.2, 0.5, 0], [-1.9, 0.8, 0], [0.9, 1.1, 0], [0.2, 1, 0], [-1.5, -0.9, 0], [1.4, 0.3, 0]];
    for (var i = 0; i < 10; i++) {
      document.getElementById("input_controlpoints_x"+i).value = p[i][0];
      document.getElementById("input_controlpoints_y"+i).value = p[i][1];
    }
    document.getElementById("input_c_numcontrolpoints").value = 4;
    hide_elements = [document.getElementsByClassName("bezier"), document.getElementsByClassName("3d")];
    show_elements = document.getElementsByClassName("catmull");
    document.getElementById("row_positions1").style.display = 'table-row';
    document.getElementById("row_positions2").style.display = 'table-row';
    document.getElementById("row_rational").style.display = 'none';
    document.getElementById("row_divisionrate").style.display = 'none';
  } else if (document.getElementById("input_3dbezier").checked) {
    p = [[-2, 1, -2], [-3, 0, -1], [-2, 2, 0], [-3, 1, 1], [-1, 0, -2], [-2, 3, -1], [0, 1, 0], [-1, 0, 1], [0, 2, -2], [1, 1, -1], [1, 0, 0], [0, -1, 1], [1, 0, -2], [3, 1, -1], [2, 2, 0], [3, 1, 1]];
    for (var i = 0; i < 16; i++) {
      document.getElementById("input_3dcontrolpoints_x"+i).value = p[i][0];
      document.getElementById("input_3dcontrolpoints_y"+i).value = p[i][1];
      document.getElementById("input_3dcontrolpoints_z"+i).value = p[i][2];
    }
    hide_elements = [document.getElementsByClassName("catmull"), document.getElementsByClassName("2d")];
    document.getElementById("row_positions1").style.display = 'none';
    document.getElementById("row_positions2").style.display = 'none';
    document.getElementById("rowspanctl").setAttribute("rowSpan",4);
    document.getElementById("row_3dpositions1").style.display = 'table-row';
    document.getElementById("row_3dpositions2").style.display = 'table-row';
    document.getElementById("row_3dpositions3").style.display = 'table-row';
    document.getElementById("row_3dpositions4").style.display = 'table-row';
  } else if (document.getElementById("input_3dcoons").checked) {
    p = [[-2, 1, -2], [-3, 0, -1], [-2, 2, 0], [-3, 1, 1], [-1, 0, 1], [0, -1, 1], [3, 1, 1], [2, 2, 0], [3, 1, -1], [1, 0, -2], [0, 2, -2], [-1, 0, -2]];
    for (var i = 0; i < 12; i++) {
      document.getElementById("input_3dcontrolpoints_x"+i).value = p[i][0];
      document.getElementById("input_3dcontrolpoints_y"+i).value = p[i][1];
      document.getElementById("input_3dcontrolpoints_z"+i).value = p[i][2];
    }
    hide_elements = [document.getElementsByClassName("catmull"), document.getElementsByClassName("2d")];
    document.getElementById("row_positions1").style.display = 'none';
    document.getElementById("row_positions2").style.display = 'none';
    document.getElementById("row_rational").style.display = 'none';
    document.getElementById("row_divisionrate").style.display = 'none';
    document.getElementById("rowspanctl").setAttribute("rowSpan",3);
    document.getElementById("row_3dpositions1").style.display = 'table-row';
    document.getElementById("row_3dpositions2").style.display = 'table-row';
    document.getElementById("row_3dpositions3").style.display = 'table-row';
    document.getElementById("row_3dpositions4").style.display = 'none';
  } else {
    p[0] = [-1.3, -0.9, 0];
    p[1] = [-0.4, 1.3, 0];
    p[2] = [1.2, -0.3, 0];
    for (var i = 3; i < 10; i++) {
      p[i] = [1.2+0.1*(i-2),0.5+(-1)**(i-1)*(0.8-0.1*(i-2)),0];
    }
    document.getElementById("input_b_numcontrolpoints").value = 3;
    show_elements = document.getElementsByClassName("bezier");
    hide_elements = [document.getElementsByClassName("catmull"), document.getElementsByClassName("3d")];
    document.getElementById("row_divisionrate").style.display = 'table-row';
    document.getElementById("row_positions1").style.display = 'none';
    document.getElementById("row_positions2").style.display = 'none';
  }
  for (var i = 0; i < hide_elements.length; i++) {
    for (var j = 0; j < hide_elements[i].length; j++) {
      hide_elements[i][j].style.display = 'none';
    }
  }
  for (var i = 0; i < show_elements.length; i++) {
    show_elements[i].style.display = 'table-row';
  }
}

function cameraview() {
  if (document.getElementById("input_catmull").checked) {
    camera.eye = [0, 0, 7];
  } else if (document.getElementById("input_3dbezier").checked) {
    camera.eye = [8, 8, 10];
  } else if (document.getElementById("input_3dcoons").checked) {
    camera.eye = [8, 8, 10];
  } else {
    camera.eye = [0, 0, 7];
  }
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
    legacygl.vertex3 = function(p) {
        this.vertex(p[0], p[1], p[2]);
    };
    drawutil = get_drawutil(gl, legacygl);
    camera = get_camera(canvas.width);
    // event handlers
    canvas.onmousedown = function(evt) {
        var mouse_win = this.get_mousepos(evt);
        if (evt.altKey) {
            camera.start_moving(mouse_win, evt.shiftKey ? "zoom" : "pan");
            return;
        } else if (evt.ctrlKey) {
            camera.start_moving(mouse_win, "rotate");
            return;
        }
        // pick nearest object
        var points = p;
        var viewport = [0, 0, canvas.width, canvas.height];
        var dist_min = 10000000;
        for (var i = 0; i < num_p; ++i) {
            var object_win = glu.project(points[i], 
                                         legacygl.uniforms.modelview.value,
                                         legacygl.uniforms.projection.value,
                                         viewport);
            var dist = vec2.dist(mouse_win, object_win);
            if (dist < dist_min) {
                dist_min = dist;
                selected = points[i];
            }
        }
    };
    canvas.onmousemove = function(evt) {
        var mouse_win = this.get_mousepos(evt);
        if (camera.is_moving()) {
            camera.move(mouse_win);
            draw();
            return;
        }
        if (selected != null) {
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
            vec3.add(selected, camera.eye, eye_to_intersection);
            draw();
        }
    }
    document.onmouseup = function (evt) {
        if (camera.is_moving()) {
            camera.finish_moving();
            return;
        }
        selected = null;
    };
    // init OpenGL settings
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(1, 1, 1, 1);
};

