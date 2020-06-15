"use strict";

// compute gradient of the source image
function compute_laplacian(source, delta) {
    var width  = source.width;
    var height = source.height;
    for (var j = 0; j < height; ++j)
    for (var i = 0; i < width ; ++i)
    {
        var idx = i + width * j;
        var di = [1, -1, 0, 0];
        var dj = [0, 0, 1, -1];
        var cnt = 0;
        var sum = [0, 0, 0];
        for (var k = 0; k < 4; ++k) {
            var i2 = i + di[k];
            var j2 = j + dj[k];
            if (i2 < 0 || j2 < 0 || width <= i2 || height <= j2) continue;
            ++cnt;
            var idx2 = i2 + width * j2;
            for (var c = 0; c < 3; ++c)
                sum[c] += source.data[4 * idx2 + c];
        }
        for (var c = 0; c < 3; ++c) {
            delta.fdata[4 * idx + c] = source.data[4 * idx + c];
            delta.fdata[4 * idx + c] += 128 - sum[c] / cnt;
            delta.data[4 * idx + c] = delta.fdata[4 * idx + c];
        }
        delta.data[4 * idx + 3] = 255;
    }
};
function poisson_jacobi(mask, delta, offset_x, offset_y, result) {
    var src_width  = mask.width;
    var src_height = mask.height;
    var tgt_width  = result.width;
    var tgt_height = result.height;
    for (var tgt_j = 0; tgt_j < tgt_height; ++tgt_j)
    for (var tgt_i = 0; tgt_i < tgt_width ; ++tgt_i)
    {
        var tgt_idx = tgt_i + tgt_width * tgt_j;
        var src_i = tgt_i - offset_x;
        var src_j = tgt_j - offset_y;
        if (src_i < 0 || src_j < 0 || src_width <= src_i || src_height <= src_j) continue;
        var src_idx = src_i + src_width * src_j;
        if (mask.data[4 * src_idx + 3] == 0) continue;
        var di = [1, -1, 0, 0];
        var dj = [0, 0, 1, -1];
        var cnt = 0;
        var sum = [0, 0, 0];
        for (var k = 0; k < 4; ++k) {
            var tgt_i2 = tgt_i + di[k];
            var tgt_j2 = tgt_j + dj[k];
            if (tgt_i2 < 0 || tgt_j2 < 0 || tgt_width <= tgt_i2 || tgt_height <= tgt_j2) continue;
            ++cnt;
            var tgt_idx2 = tgt_i2 + tgt_width * tgt_j2;
            for (var c = 0; c < 3; ++c)
                sum[c] += result.fdata[4 * tgt_idx2 + c];
        }
        for (var c = 0; c < 3; ++c)
            result.data [4 * tgt_idx + c] =
            result.fdata[4 * tgt_idx + c] = delta.fdata[4 * src_idx + c] - 128 + sum[c] / cnt;
    }
};

function augment_fdata(imgdata) {
    imgdata.fdata = new Float32Array(imgdata.data.length);
    for (var i = 0; i < imgdata.data.length; ++i)
        imgdata.fdata[i] = imgdata.data[i];
};

function read_img(context, img) {
    context.canvas.width  = img.width;
    context.canvas.height = img.height;
    context.drawImage(img, 0, 0);
    return context.getImageData(0, 0, img.width, img.height);
};

function write_img(context, img, data) {
    context.canvas.width  = data.width;
    context.canvas.height = data.height;
    context.putImageData(data, 0, 0);
    img.src = context.canvas.toDataURL();
};

window.onload = function() {
    // img elements
    var img_source = document.getElementById("img_source");
    var img_source_delta  = document.getElementById("img_source_delta" );
    var img_target = document.getElementById("img_target");
    var img_target_delta  = document.getElementById("img_target_delta" );
    var img_result = document.getElementById("img_result");

    // canvas for painting mask
    var canvas_mask = document.getElementById("canvas_mask");
    var context_mask = canvas_mask.getContext("2d");

    // hidden canvas for reading/writing images
    var canvas_hidden = document.createElement("canvas");
    var context_hidden = canvas_hidden.getContext("2d");

    // image dimensions
    var src_width;
    var src_height;
    var tgt_width;
    var tgt_height;

    // image data
    var source;
    var mask;
    var delta;
    var target;
    var result;
    
    img_source.onload = function(){
        src_width  = canvas_mask.width  = img_source_delta.width  = this.width;
        src_height = canvas_mask.height = img_source_delta.height = this.height;
        source = read_img(context_hidden, img_source);
        context_mask.clearRect(0, 0, src_width, src_height);
        mask = context_mask.getImageData(0, 0, src_width, src_height);
        delta = context_hidden.createImageData(src_width, src_height);
        augment_fdata(delta);
        compute_laplacian(source, delta);
        write_img(context_hidden, img_source_delta, delta);
    };
    document.getElementById("input_file_source").onchange = function(evt) {
        var reader = new FileReader();
        reader.readAsDataURL(evt.target.files[0]);
        reader.onload = function(){
            img_source.src = this.result;
        };
    };
    
    img_target.onload = function(){
        tgt_width  = img_result.width  = this.width;
        tgt_height = img_result.height = this.height;
        target = read_img(context_hidden, img_target);
        delta = context_hidden.createImageData(src_width, src_height);
        augment_fdata(delta);
        compute_laplacian(target, delta);
        write_img(context_hidden, img_target_delta, delta);
        init_result();
    };
    document.getElementById("input_file_target").onchange = function(evt) {
        var reader = new FileReader();
        reader.readAsDataURL(evt.target.files[0]);
        reader.onload = function(){
            img_target.src = this.result;
        };
    };
    
    // simple drawing ui for canvas_mask
    var mousedown = false;
    canvas_mask.onmousedown = function(evt) {
        mousedown = true;
    };
    canvas_mask.onmousemove = function(evt) {
        if (!mousedown) return;
        // draw scribble
        var mousepos = this.get_mousepos(evt, false);
        context_mask.strokeStyle = "white";
        context_mask.lineJoin = "round";
        context_mask.lineWidth = Number(document.getElementById("input_num_scribble_radius").value);
        context_mask.beginPath();
        context_mask.moveTo(mousepos[0] - 1, mousepos[1] - 1);
        context_mask.lineTo(mousepos[0] + 1, mousepos[1] - 1);
        context_mask.lineTo(mousepos[0] + 1, mousepos[1] + 1);
        context_mask.lineTo(mousepos[0] - 1, mousepos[1] + 1);
        context_mask.closePath();
        context_mask.stroke();
        // copy source to masked region for better visualization
        mask = context_mask.getImageData(0, 0, src_width, src_height);
        for (var j = 0; j < src_height; ++j)
        for (var i = 0; i < src_width ; ++i)
        {
            var idx = i + src_width * j;
            if (mask.data[4 * idx + 3] == 0) continue;
            for (var c = 0; c < 3; ++c)
                mask.data[4 * idx + c] = source.data[4 * idx + c];
        }
        context_mask.putImageData(mask, 0, 0);
        init_result();
        evt.preventDefault();
    };
    canvas_mask.onmouseup = function(evt) {
        mousedown = false;
    };
    
    document.getElementById("input_num_offset_x").onchange = function() { init_result(); };
    document.getElementById("input_num_offset_y").onchange = function() { init_result(); };
    document.getElementById("btn_iterate").onclick = function() {
        var offset_x = Number(document.getElementById("input_num_offset_x").value);
        var offset_y = Number(document.getElementById("input_num_offset_y").value);
        var numiter  = Number(document.getElementById("input_num_numiter" ).value);
        if (document.getElementById("input_chk_normal").checked)
            for (var i = 0; i < numiter; ++i)  
                poisson_jacobi(mask, delta, offset_x, offset_y, result);
        else if (document.getElementById("input_chk_mixing").checked)
            for (var i = 0; i < numiter; ++i)
                mixing
        write_img(context_hidden, img_result, result);
    };
    document.getElementById("btn_clear").onclick = function() {
        context_mask.clearRect(0, 0, src_width, src_height);
        mask = context_mask.getImageData(0, 0, src_width, src_height);
        init_result();
    };
    
    function init_result() {
        result = read_img(context_hidden, img_target);
        var offset_x = Number(document.getElementById("input_num_offset_x").value);
        var offset_y = Number(document.getElementById("input_num_offset_y").value);
        for (var tgt_j = 0; tgt_j < tgt_height; ++tgt_j)
        for (var tgt_i = 0; tgt_i < tgt_width ; ++tgt_i)
        {
            var tgt_idx = tgt_i + tgt_width * tgt_j;
            var src_i = tgt_i - offset_x;
            var src_j = tgt_j - offset_y;
            if (src_i < 0 || src_j < 0 || src_width <= src_i || src_height <= src_j) continue;
            var src_idx = src_i + src_width * src_j;
            if (mask.data[4 * src_idx + 3] == 0) continue;
            for (var c = 0; c < 3; ++c)
                result.data[4 * tgt_idx + c] = source.data[4 * src_idx + c];
        }
        write_img(context_hidden, img_result, result);
        augment_fdata(result);
    };
    
    img_source.src = "https://cdn.glitch.com/dd1057e3-9b69-4706-a8c9-e7f207f3d7cb%2Fpoisson_source.png?v=1562149016431";
    img_target.src = "https://cdn.glitch.com/dd1057e3-9b69-4706-a8c9-e7f207f3d7cb%2Fpoisson_target.png?v=1562149016454";
};
function toggle_opts(self) {
    if (self.id == "input_chk_normal")
        document.getElementById("mask").style.display = "table-cell";
    else
        document.getElementById("mask").style.display = "none";
        
    if (self.id == "input_chk_mixing")
        document.getElementById("target_delta").style.display = "table-cell";
    else
        document.getElementById("target_delta").style.display = "none";
};