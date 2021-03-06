var canvas = document.createElement("canvas");
var context = canvas.getContext("2d");
var rock_url = "https://cdn.glitch.com/d7a5350c-2fd9-452d-8711-e051480a63a6%2Frock.png?v=1592128589573";
var man_url = "https://cdn.glitch.com/d7a5350c-2fd9-452d-8711-e051480a63a6%2Fman.png?v=1592149019291";
var hdr_url = "https://cdn.glitch.com/d7a5350c-2fd9-452d-8711-e051480a63a6%2Fhdr.png?v=1592210449566";
var dog_url = "https://cdn.glitch.com/d7a5350c-2fd9-452d-8711-e051480a63a6%2Fdog.png?v=1592128589634";
var house_url = "https://cdn.glitch.com/d7a5350c-2fd9-452d-8711-e051480a63a6%2Fhouse.png?v=1592128943149";
function clamp(min,opt,max) {
    if (opt < min)
        return min;
    if (opt > max)
        return max;
    return opt;
};
function grayscale(width, height, original, gray) {
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r = original[4 * idx0];
        var g = original[4 * idx0 + 1];
        var b = original[4 * idx0 + 2];
        gray[idx0] = (77*r+151*g+28*b)/256;
    }
};
function smooth_gaussian(width, height, original, smoothed, sigma) {
    var r = Math.ceil(sigma * 3);
    var r2 = 2 * r + 1;
    // precompute spatial stencil
    var stencil = new Float32Array(r2 * r2);
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var h = Math.sqrt(dx * dx + dy * dy);
        var idx = dx + r + r2 * (dy + r);
        stencil[idx] = Math.exp(-h * h / (2 * sigma * sigma));
    }
    // apply filter
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r_sum = 0;
        var g_sum = 0;
        var b_sum = 0;
        var w_sum = 0;
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                var w = stencil[dx + r + r2 * (dy + r)];
                var idx1 = px1 + width * py1;
                var r1 = original[4 * idx1];
                var g1 = original[4 * idx1 + 1];
                var b1 = original[4 * idx1 + 2];
                r_sum += w * r1;
                g_sum += w * g1;
                b_sum += w * b1;
                w_sum += w;
            }
        }
        smoothed[4 * idx0    ] = r_sum / w_sum;
        smoothed[4 * idx0 + 1] = g_sum / w_sum;
        smoothed[4 * idx0 + 2] = b_sum / w_sum;
        smoothed[4 * idx0 + 3] = 255;
    }
};
function smooth_bilateral(width, height, color_img, texture_img, smoothed, sigma_space, sigma_range) {
    var r = Math.ceil(sigma_space * 3);
    var r2 = 2 * r + 1;
    // precompute spatial stencil_space
    var stencil_space = new Float32Array(r2 * r2);
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var h = Math.sqrt(dx * dx + dy * dy);
        var idx = dx + r + r2 * (dy + r);
        stencil_space[idx] = Math.exp(-h * h / (2 * sigma_space * sigma_space));
    }  
    // apply filter
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r0 = texture_img[4 * idx0];
        var g0 = texture_img[4 * idx0 + 1];
        var b0 = texture_img[4 * idx0 + 2];
        var r_sum = 0;
        var g_sum = 0;
        var b_sum = 0;
        var w_sum = 0;
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                var w_space = stencil_space[dx + r + r2 * (dy + r)];
                var idx1 = px1 + width * py1;
                var r1 = texture_img[4 * idx1];
                var g1 = texture_img[4 * idx1 + 1];
                var b1 = texture_img[4 * idx1 + 2];
                var r_diff = r1 - r0;
                var g_diff = g1 - g0;
                var b_diff = b1 - b0;
                var w_range = Math.exp(-(r_diff * r_diff + g_diff * g_diff + b_diff * b_diff)/ (2 * sigma_range * sigma_range));
                var w = w_space * w_range;
                var r1 = color_img[4 * idx1];
                var g1 = color_img[4 * idx1 + 1];
                var b1 = color_img[4 * idx1 + 2];
                r_sum += w * r1;
                g_sum += w * g1;
                b_sum += w * b1;
                w_sum += w;
            }
        }
        smoothed[4 * idx0    ] = r_sum / w_sum;
        smoothed[4 * idx0 + 1] = g_sum / w_sum;
        smoothed[4 * idx0 + 2] = b_sum / w_sum;
        smoothed[4 * idx0 + 3] = 255;
    }
};
function trilinear_interpolation(x, y, sigma_space, sigma_range, grid, px, py, pz, i) {
    px /= sigma_space;
    py /= sigma_space;
    pz /= sigma_range;
    var x0 = Math.floor(px);
    var y0 = Math.floor(py);
    var z0 = Math.floor(pz);
    var idx = x0 + x * y0 + x * y * z0;
//     var c000 = grid[3 * idx + i];
//     var c001 = grid[3 * (idx + 1) + i];
//     var c010 = grid[3 * (idx + x) + i];
//     var c011 = grid[3 * (idx + 1 + x) + i];
//     var idxz = idx + x * y;
//     var c100 = grid[3 * idxz + i];
//     var c101 = grid[3 * (idxz + 1) + i];
//     var c110 = grid[3 * (idxz + x) + i];
//     var c111 = grid[3 * (idxz + 1 + x) + i];
//     var px1 = px - x0;
//     var px0 = 1 - px1;
//     var py1 = py - y0;
//     var py0 = 1 - py1;
//     var pz1 = pz - z0;
//     var pz0 = 1 - pz1;
//     return c000*pz0*py0*px0 + c001*pz0*py0*px1 + c010*pz0*py1*px0 + c011*pz0*py1*px1 + c100*pz1*py0*px0 + c101*pz1*py0*px1 + c110*pz1*py1*px0 + c111*pz1*py1*px1;
      
  
    var c000 = grid[idx];
    var c001 = grid[idx + 1];
    var c010 = grid[idx + x];
    var c011 = grid[idx + 1 + x];
    var idxz = idx + x * y;
    var c100 = grid[idxz];
    var c101 = grid[idxz + 1];
    var c110 = grid[idxz + x];
    var c111 = grid[idxz + 1 + x];
    var px1 = px - x0;
    var px0 = 1 - px1;
    var py1 = py - y0;
    var py0 = 1 - py1;
    var pz1 = pz - z0;
    var pz0 = 1 - pz1;
    return c000*pz0*py0*px0 + c001*pz0*py0*px1 + c010*pz0*py1*px0 + c011*pz0*py1*px1 + c100*pz1*py0*px0 + c101*pz1*py0*px1 + c110*pz1*py1*px0 + c111*pz1*py1*px1;
};
function smooth_bilateral_grid(width, height, color_img, texture_img, smoothed, sigma_space, sigma_range) {
    var texture_gray = new Float32Array(width * height);
    grayscale(width, height, texture_img, texture_gray);
    
    var x = Math.ceil((width-1)/sigma_space)+1;
    var y = Math.ceil((height-1)/sigma_space)+1;
    var z = Math.ceil(255/sigma_range)+1;
  
    var bilateral_grid = new Float32Array(3 * x * y * z).fill(0);
    var bilateral_grid_cnt = new Float32Array(3 * x * y * z).fill(0);
    // initialize grid
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var l = texture_gray[idx0];
        var idx1 = Math.round(px/sigma_space) + x * Math.round(py/sigma_space) + x * y * Math.round(l/sigma_range);
        bilateral_grid[idx1] += l;
        bilateral_grid_cnt[idx1] += 1;
        // for (var i = 0; i < 3; i++) {
        //     var l = texture_img[4 * idx0 + i];
        //     var idx1 = Math.round(px/sigma_space) + x * Math.round(py/sigma_space) + x * y * Math.round(l/sigma_range);
        //     bilateral_grid[3 * idx1 + i] += l;
        //     bilateral_grid_cnt[3 * idx1 + 1] += 1;
        // }
        
    }
    // console.log(bilateral_grid_cnt);
    // console.log(bilateral_grid);
  
    var r = 2;
    var r2 = 2 * r + 1;
    // precompute spatial stencil
    var stencil = new Float32Array(r2 * r2 * r2);
    for (var dz = -r; dz <= r; ++dz)
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var h = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var idx = dx + r + r2 * (dy + r) + r2 * r2 * (dz + r);
        stencil[idx] = Math.exp(-h * h / 2);
    }
  
    // apply filter to bilateral grid
    var bilateral_grid_filtered = new Float32Array(3 * x * y * z).fill(0);
    for (var pz = 0; pz < z; pz++)
    for (var py = 0; py < y; py++)
    for (var px = 0; px < x; px++)
    {
        var idx0 = px + x * py + x * y * pz;
        var l_sum = 0;
        var w_sum = 0;
        // var l_sum = new Float32Array(3).fill(0);
        // var w_sum = new Float32Array(3).fill(0);
        for (var dz = -r; dz <= r; ++dz)
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            var pz1 = pz + dz;
            if (0 <= px1 && 0 <= py1 && 0 <= pz1 && px1 < x && py1 < y && pz1 < z) {
                var w = stencil[dx + r + r2 * (dy + r) + r2 * r2 * (dz + r)];
                var idx1 = px1 + x * py1 + x * y * pz1;
                // for (var i = 0; i < 3; i++) {
                //     var l1 = bilateral_grid[3 * idx1 + i];
                //     var cnt1 = bilateral_grid_cnt[3 * idx1 + i];
                //     l_sum[i] += w * l1;
                //     w_sum[i] += w * cnt1;
                // }
                var l1 = bilateral_grid[idx1];
                var cnt1 = bilateral_grid_cnt[idx1];
                l_sum += w * l1;
                w_sum += w * cnt1;
            }
        }      
        if (w_sum != 0)
            bilateral_grid_filtered[idx0] = l_sum / w_sum;
        // for (var i = 0; i < 3; i++) {
        //     if (w_sum[i] != 0) {
        //         bilateral_grid_filtered[3 * idx0 + i] = l_sum[i] / w_sum[i];
        //     }
        // }
    }
  
    // apply bilateral grid to original image
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var l = texture_gray[idx0];
        var w = trilinear_interpolation(x, y, sigma_space, sigma_range, bilateral_grid_filtered, px, py, l)/l;
        var r = color_img[4 * idx0];
        var g = color_img[4 * idx0 + 1];
        var b = color_img[4 * idx0 + 2];
        smoothed[4 * idx0    ] = Math.min(r * w, 255);
        smoothed[4 * idx0 + 1] = Math.min(g * w, 255);
        smoothed[4 * idx0 + 2] = Math.min(b * w, 255);
        // for (var i = 0; i < 3; i++) {
        //     var l = texture_img[4 * idx0 + i];
        //     var w = trilinear_interpolation(x, y, sigma_space, sigma_range, bilateral_grid_filtered, px, py, l, i)/l;
        //     var c = color_img[4 * idx0 + i];
        //     smoothed[4 * idx0 + i] = c * w;
        // }
      
        // if (bilateral_grid[idx0] == 6375) {
        //   console.log(l, w, trilinear_interpolation(x, y, sigma_space, sigma_range, bilateral_grid_filtered, px, py, l));
        // }
        // if (r*w > 80 && r*w < 120 && g < 20 && b < 20) {
        //   smoothed[4 * idx0    ] = 0;
        //   smoothed[4 * idx0 + 1] = 255;
        //   smoothed[4 * idx0 + 2] = 0;
        //   var idx = Math.round(px/sigma_space) + x * Math.round(py/sigma_space) + x * y * Math.round(l/sigma_range);
        //   console.log(r,g,b,w,l,bilateral_grid[idx],bilateral_grid_cnt[idx],bilateral_grid_filtered[idx]);
        // }
        smoothed[4 * idx0 + 3] = 255;
    }
};
function edge_detection(width, height, original, smoothed, sigma_edge, phi) {
    var original_gray = new Float32Array(width * height);
    grayscale(width, height, original, original_gray);
  
    var r = 2;
    var r2 = 2 * r + 1;
    // precompute spatial stencil_edge_e and stencil_edge_r
    var stencil_edge_e = new Float32Array(r2 * r2);
    var sigma_edge_r = Math.sqrt(1.6) * sigma_edge;
    var stencil_edge_r = new Float32Array(r2 * r2);
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var h = Math.sqrt(dx * dx + dy * dy);
        var idx = dx + r + r2 * (dy + r);
        stencil_edge_e[idx] = Math.exp(-h * h / (2 * sigma_edge * sigma_edge));
        stencil_edge_r[idx] = Math.exp(-h * h / (2 * sigma_edge_r * sigma_edge_r));
    }
    // apply filter
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r0 = original[4 * idx0];
        var g0 = original[4 * idx0 + 1];
        var b0 = original[4 * idx0 + 2];
        var s_e = 0;
        var w_e_sum = 0;
        var s_r = 0;
        var w_r_sum = 0;
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                var w_e = stencil_edge_e[dx + r + r2 * (dy + r)];
                var w_r = stencil_edge_r[dx + r + r2 * (dy + r)];
                var idx1 = px1 + width * py1;
                var l = original_gray[idx1];
                s_e += l * w_e;
                w_e_sum += w_e;
                s_r += l * w_r;
                w_r_sum += w_r;
            }
        }
        s_e /= w_e_sum;
        s_r /= w_r_sum;
      
        var S = s_e - s_r;
        if (S <= 0) {
            smoothed[4 * idx0    ] = r0;
            smoothed[4 * idx0 + 1] = g0;
            smoothed[4 * idx0 + 2] = b0;
        } else {
            var D = 1 + Math.tanh(- S * phi);
            smoothed[4 * idx0    ] = r0 * D;
            smoothed[4 * idx0 + 1] = g0 * D;
            smoothed[4 * idx0 + 2] = b0 * D;
        }    
        smoothed[4 * idx0 + 3] = 255;
    }
};
function smooth_stylization(width, height, original, smoothed, sigma_space, sigma_range, sigma_edge, phi) {
    var tmp_bilateral = new Float32Array(4 * width * height);
    smooth_bilateral(width, height, original, original, tmp_bilateral, sigma_space, sigma_range);
    edge_detection(width, height, tmp_bilateral, smoothed, sigma_edge, phi);
};
function gamma_correction(width, height, original, corrected, gamma) {
    var stencil = new Float32Array(256);
    for (var dr = 0; dr < 256; ++dr)
    {
        stencil[dr] = Math.round(Math.pow(dr/255, 1/gamma) * 255);
    }
    // apply filter
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r0 = Math.round(original[4 * idx0]);
        var g0 = Math.round(original[4 * idx0 + 1]);
        var b0 = Math.round(original[4 * idx0 + 2]);
        corrected[4 * idx0    ] = stencil[r0];
        corrected[4 * idx0 + 1] = stencil[g0];
        corrected[4 * idx0 + 2] = stencil[b0];
        corrected[4 * idx0 + 3] = 255;
    }
  
};
function smooth_tone_mapping(width, height, original, smoothed, sigma_space, sigma_range, gamma) {
    var tmp_large = new Float32Array(4 * width * height);
    var tmp_detail = new Float32Array(4 * width * height);
    var tmp_gamma = new Float32Array(4 * width * height);
    smooth_bilateral(width, height, original, original, tmp_large, sigma_space, sigma_range);
    subtract(width, height, original, tmp_large, tmp_detail);
    gamma_correction(width, height, tmp_large, tmp_gamma, gamma);
    merge(width, height, tmp_gamma, tmp_detail, smoothed);
};
function smooth_rolling(width, height, original, smoothed, sigma_space, sigma_range, num) {
    var tmp_input = new Float32Array(4 * width * height);
    var tmp_output = new Float32Array(4 * width * height);
    smooth_gaussian(width, height, original, tmp_input, sigma_space);
    var i;
    // choose the faster between bilateral and bilateral grid
    if (sigma_space * sigma_space * sigma_range <= 255 || true) {
        for (i = 0; i < num-2; i++) {
            smooth_bilateral(width, height, original, tmp_input, tmp_output, sigma_space, sigma_range);
            smooth_bilateral(width, height, original, tmp_output, tmp_input, sigma_space, sigma_range);
        }
        if (i == num-2) {
            smooth_bilateral(width, height, original, tmp_input, tmp_output, sigma_space, sigma_range);
            smooth_bilateral(width, height, original, tmp_output, smoothed, sigma_space, sigma_range);
        } else {
            smooth_bilateral(width, height, original, tmp_input, smoothed, sigma_space, sigma_range);
        }
    } else {
        for (i = 0; i < num-2; i++) {
            smooth_bilateral_grid(width, height, original, tmp_input, tmp_output, sigma_space, sigma_range);
            smooth_bilateral_grid(width, height, original, tmp_output, tmp_input, sigma_space, sigma_range);
        }
        if (i == num-2) {
            smooth_bilateral_grid(width, height, original, tmp_input, tmp_output, sigma_space, sigma_range);
            smooth_bilateral_grid(width, height, original, tmp_output, smoothed, sigma_space, sigma_range);
        } else {
            smooth_bilateral_grid(width, height, original, tmp_input, smoothed, sigma_space, sigma_range);
        }
    }
    
};
function neighbor_vector(width, height, image, r, cx, cy, nvec) {
    var r2 = 2 * r + 1;
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var px = clamp(0,cx+dx,width-1);
        var py = clamp(0,cy+dy,height-1);
        var idx0 = px + width * py;
        var idx1 = (dx + r) + r2 * (dy + r);
        for (var i = 0; i < 3; i++)
          nvec[3 * idx1 + i] = image[4 * idx0 + i];
    }
};
function smooth_nlmf(width, height, original, smoothed, sigma) {
    var r = 3;
    var r2 = 2 * r + 1;
    var vec_size = r2 * r2 * 3;
    // apply filter
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var nvec0 = new Float32Array(vec_size).fill(0);
        neighbor_vector(width, height, original, r, px, py, nvec0);
        var r_sum = 0;
        var g_sum = 0;
        var b_sum = 0;
        var w_sum = 0;
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                var nvec1 = new Float32Array(vec_size).fill(0);
                neighbor_vector(width, height, original, r, px1, py1, nvec1);
                
                var norm = 0;
                for (var i = 0; i < vec_size; i++) {
                    var tmp = nvec0[i] - nvec1[i]
                    norm += tmp * tmp;
                }
              
                var w = Math.exp(-norm/ (2 * sigma * sigma * vec_size * vec_size));
                var idx1 = px1 + width * py1;
                var r1 = original[4 * idx1];
                var g1 = original[4 * idx1 + 1];
                var b1 = original[4 * idx1 + 2];
                r_sum += w * r1;
                g_sum += w * g1;
                b_sum += w * b1;
                w_sum += w;
            }
        }
        smoothed[4 * idx0    ] = r_sum / w_sum;
        smoothed[4 * idx0 + 1] = g_sum / w_sum;
        smoothed[4 * idx0 + 2] = b_sum / w_sum;
        smoothed[4 * idx0 + 3] = 255;
    }
};
function merge(width, height, large, detail, merged) {
    for (var i = 0; i < width * height; ++i) {
        for (var j = 0; j < 3; ++j) {
            var ij = 4 * i + j;
            merged[ij] = large[ij] + detail[ij] - 128;
        }
        merged[4 * i + 3] = 255;
    }
};
function subtract(width, height, original, smoothed, detail) {
    for (var i = 0; i < width * height; ++i) {
        for (var j = 0; j < 3; ++j) {
            var ij = 4 * i + j;
            detail[ij] = 128 + original[ij] - smoothed[ij];
        }
        detail[4 * i + 3] = 255;
    }
};
function enhance_detail(width, height, smoothed, detail, scaling, enhanced) {
    for (var i = 0; i < width * height; ++i) {
        for (var j = 0; j < 3; ++j) {
            var ij = 4 * i + j;
            enhanced[ij] = Math.min(255, Math.max(0, smoothed[ij] + scaling * (detail[ij] - 128)));
        }
        enhanced[4 * i + 3] = 255;
    }
};
function init() {
    document.getElementById("img_original").onload = function(){
        canvas.width  = this.width;
        canvas.height = this.height;
        document.getElementById("img_smoothed").width  = this.width;
        document.getElementById("img_smoothed").height = this.height;
        document.getElementById("img_detail"  ).width  = this.width;
        document.getElementById("img_detail"  ).height = this.height;
        document.getElementById("img_enhanced").width  = this.width;
        document.getElementById("img_enhanced").height = this.height;
    };
    document.getElementById("input_file_original").onchange = function(evt) {
        var reader = new FileReader();
        reader.readAsDataURL(evt.target.files[0]);
        reader.onload = function(){
            document.getElementById("img_original").src = this.result;
        };
    };
    document.getElementById("btn_do_smoothing").onclick = function() {
        var width = canvas.width;
        var height = canvas.height;
        // read original
        context.drawImage(document.getElementById("img_original"), 0, 0);
        var original = context.getImageData(0, 0, width, height);
        // do smoothing
        var smoothed = context.createImageData(width, height);
        var sigma_space = Number(document.getElementById("input_num_sigma_space").value);
        var sigma_range = Number(document.getElementById("input_num_sigma_range").value);
        var sigma_edge = Number(document.getElementById("input_num_sigma_edge").value);
        var phi = Number(document.getElementById("input_num_falloff").value);
        var gamma = Number(document.getElementById("input_num_gamma").value);
        var num = Number(document.getElementById("input_num_iteration").value);
      
        const startTime = performance.now();
        if (document.getElementById("input_chk_use_bilateral").checked) {
            smooth_bilateral(width, height, original.data, original.data, smoothed.data, sigma_space, sigma_range);
        } else if (document.getElementById("input_chk_use_bilateral_grid").checked) {
            smooth_bilateral_grid(width, height, original.data, original.data, smoothed.data, sigma_space, sigma_range);
        } else if (document.getElementById("input_chk_use_stylization").checked) {
            smooth_stylization(width, height, original.data, smoothed.data, sigma_space, sigma_range, sigma_edge, phi);
        } else if (document.getElementById("input_chk_use_tone_mapping").checked) {
            smooth_tone_mapping(width, height, original.data, smoothed.data, sigma_space, sigma_range, gamma);
        } else if (document.getElementById("input_chk_use_rolling").checked) {
            smooth_rolling(width, height, original.data, smoothed.data, sigma_space, sigma_range, num);
        } else if (document.getElementById("input_chk_use_nlmf").checked) {
            smooth_nlmf(width, height, original.data, smoothed.data, sigma_space);
        } else {
            smooth_gaussian(width, height, original.data, smoothed.data, sigma_space);
        }
        const endTime = performance.now();
        const elapsed = Math.round(endTime - startTime)/1000;
        document.getElementById("elapsed_time").textContent = "Elapsed time: " + elapsed + " [s]";
      
        context.putImageData(smoothed, 0, 0);
        document.getElementById("img_smoothed").src = canvas.toDataURL();
        // detail = original - smoothed
        var detail = context.createImageData(width, height);
        subtract(width, height, original.data, smoothed.data, detail.data);
        context.putImageData(detail, 0, 0);
        document.getElementById("img_detail").src = canvas.toDataURL();
    };
    document.getElementById("btn_enhance_detail").onclick = function() {
        var width = canvas.width;
        var height = canvas.height;
        // read smoothed and detail
        context.drawImage(document.getElementById("img_smoothed"), 0, 0);
        var smoothed = context.getImageData(0, 0, width, height);
        context.drawImage(document.getElementById("img_detail"), 0, 0);
        var detail = context.getImageData(0, 0, width, height);
        // enhanced = smoothed + scale * detail
        var enhanced = context.createImageData(width, height);
        var detail_scaling = Number(document.getElementById("input_num_detail_scaling").value);
        enhance_detail(width, height, smoothed.data, detail.data, detail_scaling, enhanced.data);
        context.putImageData(enhanced, 0, 0);
        document.getElementById("img_enhanced").src = canvas.toDataURL();
    };
    // document.getElementById("img_original").src = "https://cdn.glitch.com/1214143e-0c44-41fb-b1ad-e9aa3347cdaa%2Frock.png?v=1562148154890";
    document.getElementById("img_original").src = rock_url;
};

function toggle_imgs(self) {
    if (self.id == "input_chk_rock")
        document.getElementById("img_original").src = rock_url;
    else if (self.id == "input_chk_man")
        document.getElementById("img_original").src = man_url;
    else if (self.id == "input_chk_hdr")
        document.getElementById("img_original").src = hdr_url;
    else if (self.id == "input_chk_dog")
        document.getElementById("img_original").src = dog_url;
    else if (self.id == "input_chk_house")
        document.getElementById("img_original").src = house_url;
}

function toggle_items(self) {
    if (self.id == "input_chk_use_bilateral" || self.id == "input_chk_use_bilateral_grid" || self.id == "input_chk_use_stylization" || self.id == "input_chk_use_tone_mapping" || self.id == "input_chk_use_rolling")
        document.getElementById("input_num_sigma_range").disabled = false;
    else
        document.getElementById("input_num_sigma_range").disabled = true;
  
    if (self.id == "input_chk_use_stylization")
        document.getElementById("input_num_sigma_edge").disabled = false;
    else
        document.getElementById("input_num_sigma_edge").disabled = true;
  
    if (self.id == "input_chk_use_stylization")
        document.getElementById("input_num_falloff").disabled = false;
    else
        document.getElementById("input_num_falloff").disabled = true;
  
    if (self.id == "input_chk_use_tone_mapping")
        document.getElementById("input_num_gamma").disabled = false;
    else
        document.getElementById("input_num_gamma").disabled = true;
  
    if (self.id == "input_chk_use_rolling")
        document.getElementById("input_num_iteration").disabled = false;
    else
        document.getElementById("input_num_iteration").disabled = true;
};