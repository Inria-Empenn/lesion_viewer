papaya.Container.syncViewers = true;

// Remove smooth display:
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'smoothDisplay', 'No', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'showOrientation', 'Yes', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);
papaya.viewer.Viewer.MAX_OVERLAYS = 12;
papaya.utilities.PlatformUtils.smallScreen = false;
// To draw / change the data of a volume:
// papayaContainers[0].viewer.screenVolumes[3].volume.imageData.data[i] = 1

papaya.Container.atlasWorldSpace = false
var params = [];

params['images'] = [];

let current_lesion_index = 0;

let image_archive = null;
let images_url = null;
let image_files = null;
let task = {};
let lesions = [];
let grid = null;
let editable_image_data = null;
// let world_space = true;

let show_loader = () => {
    let loader = document.getElementById('loader')
    loader.classList.remove('hide')
}

let hide_loader = () => {
    let loader = document.getElementById('loader')
    loader.classList.add('hide')
}

let update_best_segmentation = ()=> {
    if(task.fields == null || task.fields.findIndex((e)=>e.field=='best_segmentation')<0) {
        return
    }
    let container = document.getElementById('toggle-visibility-buttons')
    let checkboxes = container.querySelectorAll('input[type="checkbox"]')
    let best_segmentation_string = ''
    for(let checkbox of checkboxes) {
        if(checkbox.checked) {
            let checkbox_id = checkbox.id
            let name = checkbox_id.replace('checkbox_', '')
            let image_type = checkbox.getAttribute('data-image-type')
            if(image_type == 'image') {
                continue
            }
            let slider = document.getElementById('threshold_'+name+'_number')
            let plus_prefix = best_segmentation_string.length > 0 ? ' + ' : ''
            best_segmentation_string += plus_prefix + name + (slider ? ':' + slider.value : '')
        }
    }
    let best_segmentation_label = document.getElementById('best_segmentation_value')
    best_segmentation_label.textContent = best_segmentation_string
    lesions[current_lesion_index]['best_segmentation'] = best_segmentation_string
    set_data_selected_row('best_segmentation', best_segmentation_string)
    save_to_local_storage()
}

let create_checkbox = (name, image_index, visible, exclusive_button, image_type='') => {
    let container = document.getElementById('toggle-visibility-buttons')

    {/* <div>
        <label for='checkbox_name'>name</label>
        <input type='checkbox' name='name' id='checkbox_name'>
    </div> */}

    let div = document.createElement('div');
    div.classList.add('checkbox')
    let label = document.createElement('label');
    label.setAttribute('for', 'checkbox_' + name)
    label.innerText = name
    let input = document.createElement('input');
    input.setAttribute('type', 'checkbox')
    input.setAttribute('data-index', image_index)
    input.setAttribute('data-image-type', image_type)
    input.setAttribute('id', 'checkbox_' + name)
    input.setAttribute('name', name)
    input.checked = visible
    input.disabled = true
    div.appendChild(input)
    if(exclusive_button) {
        let exclusive_input = document.createElement('input');
        exclusive_input.setAttribute('type', 'button')
        exclusive_input.setAttribute('id', 'exculsive_checkbox_' + name)
        exclusive_input.setAttribute('name', name)
        exclusive_input.setAttribute('value', 'only')
        exclusive_input.checked = false
        div.appendChild(exclusive_input)
        exclusive_input.addEventListener('mousedown', (event) => {
            for(let i=0 ; i<papayaContainers[1].viewer.screenVolumes.length ; i++) {
                papaya.Container.hideImage(1, i)
            }
            if(image_index < papayaContainers[1].viewer.screenVolumes.length || papayaContainers[1].viewer.loadingVolume != null) {
                papaya.Container.showImage(1, image_index)
            }
        })
        exclusive_input.addEventListener('mouseup', (event) => {
            for(let i=0 ; i<papayaContainers[1].viewer.screenVolumes.length ; i++) {
                let checkbox = document.querySelector('input[type="checkbox"][data-index="'+i+'"]')
                if(checkbox.checked) {
                    papaya.Container.showImage(1, i)
                } else {
                    papaya.Container.hideImage(1, i)
                }
            }
            event.preventDefault()
            event.stopPropagation()
            return -1
        })
    }
    div.appendChild(label)
    container.appendChild(div);

    input.addEventListener('change', (event) => {
        if(event.target.checked) {
            if(image_index < papayaContainers[1].viewer.screenVolumes.length || papayaContainers[1].viewer.loadingVolume != null) {
                papaya.Container.showImage(1, image_index)
            }
        } else {
            if(image_index < papayaContainers[1].viewer.screenVolumes.length || papayaContainers[1].viewer.loadingVolume != null) {
                papaya.Container.hideImage(1, image_index)
            }
        update_best_segmentation()
        }
    })
}


let rle_encode = (data) => {
    let last = data[0]
    let result = [last]
    let n=1
    for(let i=1 ; i<data.length ; i++) {
        if(data[i]==last) {
            n++
        } else {
            result.push(n)
            n=1
            last = data[i]
        }
    }
    result.push(n)
    return result
}

let rle_decode = (data) => {
    let result = []
    let value = data[0]
    for(let i=1 ; i<data.length ; i++) {
        result = result.concat(Array(data[i]).fill(value))
        value = 1 - value
    }
    return result
}

let check_rle = (data) => {
    encoded = rle_encode(data)
    decoded = rle_decode(encoded)
    for(let i=0 ; i<data.length ; i++) {
        if(decoded[i] != data[i]) {
            console.log(i, decoded[i], data[i])
            break
        }
    }
}

let save_new_segmentation = () => {
    let volumes = papayaContainers[1].viewer.screenVolumes
    let editable_image_index = get_editable_image_index()
    if(editable_image_index < 0) {
        return
    }
    let volume = volumes[editable_image_index].volume
    let data = volume.imageData.data
    let meta_data = {
        header: volume.header,
        lesion: lesions[current_lesion_index],
    }
    first_image = lesions[current_lesion_index].images[editable_image_index]
    segmentation_name = first_image.file.replace(first_image.name, 'new_segmentation').replace('.nii.gz', '')
    
    if(window.parent != window) {
        // check_rle(data)
        let data_string = JSON.stringify(rle_encode(data))
        window.parent.postMessage({segmentation: { data: data_string, meta_data: JSON.stringify(meta_data, null, '\t') }})
    } else {
        downloadBlob(data, `${segmentation_name}.bin`, 'application/octet-stream');
        downloadJSON(meta_data, `${segmentation_name}.json`)    
    }

    segmentation_is_modified = false
}

let save_new_segmentation_to_local_storage = ()=> {
    // let segmentation_string = new TextDecoder('utf-8').decode(editable_image_data)
    // compressed = LZString.compressToUTF16(segmentation_string)
    // let command_index = localStorage.getItem('current-command')
    // if(command_index == null) {
    //     command_index = 0 
    // } else {
    //     command_index = parseInt(command_index) + 1
    // }
    // localStorage.setItem('current-command', command_index)
    // localStorage.setItem('history'+command_index, compressed)
    // localStorage.setItem('segmentation', compressed)
}

// let execute = (command_index)=> {
//     localStorage.setItem('current-command', command_index)
//     let compressed = localStorage.getItem('history'+command_index)
//     let segmentation_string = LZString.decompressFromUTF16(compressed)
//     editable_image_data = new TextEncoder().encode(segmentation_string)
//     papayaContainers[1].viewer.drawViewer(true, false)
// }

// let undo = ()=> {
//     let command_index = localStorage.getItem('current-command')
//     if(command_index == null) {
//         return 
//     }
//     command_index = parseInt(command_index) - 1
//     execute(command_index)
// }

// let redo = ()=> {
//     let command_index = localStorage.getItem('current-command')
//     if(command_index == null) {
//         return 
//     }
//     command_index = parseInt(command_index) + 1
//     execute(command_index)
// }

let cursor_png_size = 50

let draw_cursor = ()=> {
    const canvas = document.createElement('canvas');
    size = cursor_png_size
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d');

    // Draw the ellipse
    let scale = 5
    ctx.beginPath();
    ctx.ellipse(size/2, size/2, scale*brush_size, scale*brush_size, 0, 0, 2*Math.PI);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(size/2, size/2, 1, 1, 0, 0, 2*Math.PI);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
	ctx.strokeStyle = "white";
    let offset = 0.5;
    ctx.ellipse(size/2, size/2, scale*brush_size-2*offset, scale*brush_size-2*offset, 0, 0, 2*Math.PI);
	ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(size/2, size/2, 2, 2, 0, 0, 2*Math.PI);
	ctx.stroke();

    return canvas.toDataURL();
}

let set_brush_cursor = ()=> {
    $('#papayaViewer1 > canvas').css({'cursor': 'url('+draw_cursor()+') '+(cursor_png_size/2)+' '+(cursor_png_size/2)+', auto'})
}

let set_auto_cursor = ()=> {
    $('#papayaViewer1 > canvas').css({'cursor': 'crosshair'})
}


let create_slider = (name, image_index, visible, parameters) => {
    let container = document.getElementById('toggle-visibility-buttons')

    {/* <div>
        <label for='checkbox_name'>name</label>
        <input type='checkbox' name='name' id='checkbox_name'>
    </div> */}

    let div = document.createElement('div');
    div.classList.add('slider')
    // let label = document.createElement('label');
    // label.setAttribute('for', 'threshold_' + name)
    // label.innerText = 'Threshold'
    for(let input_type of ['range', 'number']) {

        let input = document.createElement('input');
        input.setAttribute('type', input_type)
        input.setAttribute('id', 'threshold_' + name + '_' + input_type)
        input.setAttribute('min', parameters != null && parameters.min != null ? parameters.min : 0)
        input.setAttribute('max', parameters != null && parameters.max != null ? parameters.max : 1)
        input.setAttribute('step', parameters != null && parameters.step != null ? parameters.step : 0.001)
        if(parameters != null && parameters.value != null) {
            input.setAttribute('value', parameters.value)
        }
        input.setAttribute('class', 'slider')
        input.setAttribute('data-index', image_index)
        input.setAttribute('name', name)
        input.disabled = true
        div.appendChild(input)

        input.onchange = (event)=> {
            let value = parseFloat(event.target.value)
            let min = input.value > 0.01 ? value : 0
            let max = input.value > 0.01 ? value : 1
            papayaContainers[1].viewer.screenVolumes[image_index].updateMinLUT(min*papaya.viewer.ColorTable.LUT_MAX);
            papayaContainers[1].viewer.screenVolumes[image_index].updateMaxLUT(max*papaya.viewer.ColorTable.LUT_MAX);
            papayaContainers[1].viewer.screenVolumes[image_index].updateColorBar();
            papayaContainers[1].viewer.screenVolumes[image_index].setScreenRange(min, max);
            papayaContainers[1].viewer.drawViewer(true, false);
            
            other_input_type = input_type == 'range' ? 'number' : 'range'
            let other_input = document.getElementById('threshold_' + name + '_' + other_input_type)
            other_input.value = value

            // let name = event.target.id.replace('threshold_', '')
            // let value_label = document.getElementById('threshold_label_'+name)
            // value_label.innerText = value
            // papaya.Container.hideImage(1, image_index)
            // papaya.Container.showImage(1, image_index)

            let checkbox = document.getElementById('checkbox_'+name)
            checkbox.checked = true
            checkbox.dispatchEvent(new Event('change'))

            update_best_segmentation()
        }
    }
    // let input = document.createElement('input');
    // input.setAttribute('type', 'range')
    // input.setAttribute('id', 'threshold_' + name)
    // input.setAttribute('min', parameters != null && parameters.min != null ? parameters.min : 0)
    // input.setAttribute('max', parameters != null && parameters.max != null ? parameters.max : 1)
    // input.setAttribute('step', parameters != null && parameters.step != null ? parameters.step : 0.001)
    // input.setAttribute('class', 'slider')
    // input.setAttribute('name', name)
    // input.disabled = true
    // value_label = document.createElement('label');
    // value_label.setAttribute('id', 'threshold_label_' + name)
    // value_label.innerText = ''
    // // div.appendChild(label)
    // div.appendChild(input)
    // div.appendChild(value_label)
    container.appendChild(div);

}

// let create_fill_button = (name, image_index) => {
//     let container = document.getElementById('toggle-visibility-buttons')
//     let button = document.createElement('button');
//     button.textContent = 'Fill'
//     button.addEventListener('click', (event)=> {
//         let viewer = papayaContainers[1].viewer
//         let cc = viewer.currentCoord
//         let todo = [cc]
//         let seen = new Set()
//         let threshold_number = document.getElementById('threshold_' + name + '_number')
//         let threshold = threshold_number.value
//         let volume = papayaContainers[1].viewer.screenVolumes[image_index].volume
//         let orientation = volume.transform.voxelValue.orientation
//         let offset = orientation.convertIndexToOffset(cc.x, cc.y, cc.z)
//         seen.add(offset)
//         while(todo.length > 0) {
//             flood_fill(todo, seen, threshold, image_index)
//         }
//         papayaContainers[1].viewer.drawViewer(true, false);
//     })
//     container.appendChild(button);
// }

let create_toggle_button = (button_name, image_index, visible) => {
    let container = document.getElementById('toggle-visibility-buttons')
    let toggle_button = document.createElement('button');
    toggle_button.innerHTML = visible ? 'Hide ' + button_name : 'Show ' + button_name;
    container.appendChild(toggle_button);
    toggle_button.setAttribute('data-visible', visible ? 'true' : 'false')
    toggle_button.addEventListener('click', () => {
        let visible = toggle_button.getAttribute('data-visible')
        if (visible == 'true') {
            papaya.Container.hideImage(1, image_index)
            toggle_button.innerHTML = 'Show ' + button_name
            toggle_button.setAttribute('data-visible', 'false')
        } else {
            papaya.Container.showImage(1, image_index)
            toggle_button.innerHTML = 'Hide ' + button_name
            toggle_button.setAttribute('data-visible', 'true')
        }
    })
}

let loaded_images = []
let current_image_index = 0

let get_editable_image_index = ()=> {
    return task.lesions[current_lesion_index].images.findIndex((image)=>image.editable)
}

let load_lesion_viewer = (images, image_parameters, lesion, lesion_index) => {
    let draw_button = document.getElementById('draw')    
    if(draw_button.classList.contains('active')) {
        draw_button.classList.remove('active')
        draw_button.getElementsByTagName('span')[0].textContent = 'Draw'
        drawing = false
        set_auto_cursor()
    }

    for (let li of loaded_images) {
        delete window[li.name]
    }
    loaded_images = []
    current_image_index = 0
    params = {}

    if(image_archive != null) {
        params['encodedImages'] = []
    } else if(images_url != null) {
        params['images'] = images.map((name)=> images_url + name + '?v=' + Math.random() )
    } else {
        params['files'] = images
    }

    let image_index = 0;
    // let screen_volumes = []
    for (let image_parameter of image_parameters) {

        let file_name = image_parameter.file_name
        let parameters = image_parameter.parameters
        let image_name = image_archive != null ? 'lesion_viewer_' + file_name.replace('/', '_').replace('.nii.gz', '') : file_name.split('/').at(-1)
        if(image_archive != null) {
            params['encodedImages'].push(image_name)
        }
        window[image_name] = images[image_index]
        let display_name = image_parameter.name || file_name.split('/').at(-1)
        loaded_images.push({ name: image_name, file_name: file_name, index: image_index, display_name: display_name })

        params[image_name] = parameters
        // if(image_parameter.fill_button) {
        //     create_fill_button(display_name, image_index)
        // }
        if(image_parameter.threshold_slider) {
            create_slider(display_name, image_index, image_parameter.display, image_parameter.parameters)
        }
        create_checkbox(display_name, image_index, image_parameter.display, image_parameter.exclusive_button, image_parameter.image_type)
        image_parameter.image_index = image_index
        image_index++
    }
    current_image_index = loaded_images.length-1
    // params['worldSpace'] = world_space
    params['coordinate'] = lesion['location_voxel']
    params['smoothDisplay'] = false
    // params['ignoreNiftiTransforms'] = true
    params['loadingComplete'] = () => {


        go_to_lesion(lesions[current_lesion_index])
        for (let image_parameter of image_parameters) {
            if (image_parameter.display != null && !image_parameter.display) {
                papaya.Container.hideImage(1, image_parameter.image_index)
            }
            if(image_parameter.parameters != null && image_parameter.parameters.value != null) {
                let file_name = image_parameter.file_name
                let display_name = image_parameter.name || file_name.split('/').at(-1)
                let input = document.getElementById('threshold_' + display_name + '_range')
                if(input != null) {
                    input.onchange({target: {value: image_parameter.parameters.value}})
                }
            }
        }

        let container = document.getElementById('toggle-visibility-buttons')
        let checkboxes = document.getElementsByTagName('input')
        for(let checkbox of checkboxes) {
            checkbox.disabled = false
        }
        let viewer = papayaContainers[1].viewer
        let editable_image_index = get_editable_image_index()
        if(editable_image_index < 0) {
            return
        }
        let new_segmentation_screen_volume = viewer.screenVolumes[editable_image_index]
        // new_segmentation_screen_volume.changeColorTable(viewer, 'Red Overlay')
        // new_segmentation_screen_volume.setScreenRange(0, 9)
        papayaContainers[1].toolbar.updateImageButtons()
        let new_segmentation_volume = new_segmentation_screen_volume.volume
        let data = new_segmentation_volume.imageData.data
        // for (let i = 0; i < data.length; i++) {
        //     data[i] = 0
        // }
        editable_image_data = data
        viewer.drawViewer(true, false);
    }

    let description = document.getElementById('description')
    description.innerText = `${lesion['name']} - ${lesion_index + 1}/${lesions.length}`
    
    papaya.Container.resetViewer(1, params);

    if(image_archive != null) {
        params['encodedImages'] = [params['encodedImages'][0]]
    } else if(images_url != null) {
        params['images'] = [params['images'][0]]
    } else {
        params['files'] = [images[0]]
    }

    params['loadingComplete'] = null
    papaya.Container.resetViewer(0, params);

    hide_loader()

    let canvas = papayaContainers[1].viewer.canvas
    canvas.addEventListener('mousemove', on_mouse_move, false);
    canvas.addEventListener('mousedown', on_mouse_down, false);
    canvas.addEventListener('mouseup', on_mouse_up, false);
}

let dragging = false
let drawing = false
let segmentation_is_modified = false
let filling = false
let brush_size = 1
let adding_voxels = true

let flood_fill = (todo, offsets, threshold, volumeIndex, slice, brush_value, fill3D)=> {
    let [x, y, z] = todo.shift()
    let volume = papayaContainers[1].viewer.screenVolumes[volumeIndex].volume
    // let orientation = volume.transform.voxelValue.orientation
    let offset = convert_coord_to_offset(x, y, z, volume)
    
    let volume_data = volume.imageData.data
    if(volume_data[offset] < threshold) {
        return
    }
    
    editable_image_data[offset] = adding_voxels ? brush_value : 0
    segmentation_is_modified = true

    // for(let dx=-1 ; dx<=1 ; dx++) {
    //     for(let dy=-1 ; dy<=1 ; dy++) {
    //         let offset = orientation.convertIndexToOffset(x+dx, y+dy, z)
    //         if(!offsets.has(offset) && volume_data[offset] > threshold) {
    //             todo.push([x+dx, y+dy, z])
    //         }
    //     }
    // }
    let viewer = papayaContainers[1].viewer
    let indices = fill3D ? [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] : [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]]
    if(viewer.worldSpace) {
        for(let coord of indices.slice()) {
            indices.push(coord.map((x)=>x/2))
        }
    }
    for(let deltas of indices) {
        let [dx, dy, dz] = deltas
        let [xf, yf, zf] = draw3D? [x+dx, y+dy, z+dz] : slice == 1 ? [x+dx, y+dy, z] : slice == 2 ? [x+dx, y, z+dy] : [x, y+dx, z+dy]
        let offset = convert_coord_to_offset(xf, yf, zf, volume)
        if(!offsets.has(offset)) {
            offsets.add(offset)
            todo.push([xf, yf, zf])
        }
    }
}

let draw_voxel = (x, y, z, volume, slice, brush_value) => {
    let viewer = papayaContainers[1].viewer
    let draw3Dcheckbox = document.getElementById('draw3D')
    let draw3D = draw3Dcheckbox != null && draw3Dcheckbox.checked
    bs = brush_size-1
    for(let dx=-bs ; dx<=bs ; dx+=viewer.worldSpace ? 0.5 : 1) {
        for(let dy=-bs ; dy<=bs ; dy+=viewer.worldSpace ? 0.5 : 1) {
            for(let dz=draw3D?-bs:0 ; dz<=(draw3D?bs:0) ; dz+=viewer.worldSpace ? 0.5 : 1) {
                if(Math.sqrt(dx*dx+dy*dy+dz*dz)>=brush_size) {
                    continue
                }
                let [xf, yf, zf] = draw3D? [x+dx, y+dy, z+dz] : slice == 1 ? [x+dx, y+dy, z] : slice == 2 ? [x+dx, y, z+dy] : [x, y+dx, z+dy]
                let offset = convert_coord_to_offset(xf, yf, zf, volume)
                editable_image_data[offset] = adding_voxels ? brush_value : 0
            }
        }
    }
    segmentation_is_modified = true
}

let get_xy_loc = (event)=> {
    let viewer = papayaContainers[1].viewer
    let currentMouseX = papaya.utilities.PlatformUtils.getMousePositionX(event);
    let currentMouseY = papaya.utilities.PlatformUtils.getMousePositionY(event);
    if(viewer.canvasRect == null) {
        return [currentMouseX, currentMouseY]
    }
    let xLoc = currentMouseX - viewer.canvasRect.left;
    let yLoc = currentMouseY - viewer.canvasRect.top;
    return [xLoc, yLoc]
}

let get_selected_slice = (event)=> {
    let selectedSlice = null
    let viewer = papayaContainers[1].viewer
    let [xLoc, yLoc] = get_xy_loc(event)

    if(viewer.canvasRect == null) {
        return viewer.mainSlice
    }

    if (viewer.insideScreenSlice(viewer.axialSlice, xLoc, yLoc, viewer.volume.getXDim(), viewer.volume.getYDim())) {
        selectedSlice = viewer.axialSlice
    } else if (viewer.insideScreenSlice(viewer.coronalSlice, xLoc, yLoc, viewer.volume.getXDim(), viewer.volume.getZDim())) {
        selectedSlice = viewer.coronalSlice
    } else if (viewer.insideScreenSlice(viewer.sagittalSlice, xLoc, yLoc, viewer.volume.getYDim(), viewer.volume.getZDim())) {
        selectedSlice = viewer.sagittalSlice
    }
    return selectedSlice
}

let get_cursor_position = (event)=> {
    let viewer = papayaContainers[1].viewer

    let [xLoc, yLoc] = get_xy_loc(event)

    let xImageLoc, yImageLoc, zImageLoc;

    if (viewer.insideScreenSlice(viewer.axialSlice, xLoc, yLoc, viewer.volume.getXDim(), viewer.volume.getYDim())) {
        xImageLoc = viewer.convertScreenToImageCoordinateX(xLoc, viewer.axialSlice);
        yImageLoc = viewer.convertScreenToImageCoordinateY(yLoc, viewer.axialSlice);
        zImageLoc = viewer.axialSlice.currentSlice;
    } else if (viewer.insideScreenSlice(viewer.coronalSlice, xLoc, yLoc, viewer.volume.getXDim(), viewer.volume.getZDim())) {
        xImageLoc = viewer.convertScreenToImageCoordinateX(xLoc, viewer.coronalSlice);
        zImageLoc = viewer.convertScreenToImageCoordinateY(yLoc, viewer.coronalSlice);
        yImageLoc = viewer.coronalSlice.currentSlice;
    } else if (viewer.insideScreenSlice(viewer.sagittalSlice, xLoc, yLoc, viewer.volume.getYDim(), viewer.volume.getZDim())) {
        yImageLoc = viewer.convertScreenToImageCoordinateX(xLoc, viewer.sagittalSlice);
        zImageLoc = viewer.convertScreenToImageCoordinateY(yLoc, viewer.sagittalSlice);
        xImageLoc = viewer.sagittalSlice.currentSlice;
    }

    if(viewer.worldSpace) {
        let coord = viewer.getWorldCoordinateAtIndex(xImageLoc, yImageLoc, zImageLoc, new papaya.core.Coordinate(0, 0, 0));
        xImageLoc = coord.x
        yImageLoc = coord.y
        zImageLoc = coord.z
    }

    return [xImageLoc, yImageLoc, zImageLoc]
}

let convert_coord_to_offset = (x, y, z, volume)=> {
    let viewer = papayaContainers[1].viewer

    viewerOrigin = viewer.screenVolumes[0].volume.header.origin;  // base image origin
    viewerVoxelDims = viewer.screenVolumes[0].volume.header.voxelDimensions;
    
    if(viewer.worldSpace) {
        // x = (x - viewerOrigin.x) * viewerVoxelDims.xSize
        // y = (viewerOrigin.y - y) * viewerVoxelDims.ySize
        // z = (viewerOrigin.z - z) * viewerVoxelDims.zSize
        var xTrans, yTrans, zTrans;
        
        let worldMat = volume.transform.worldMat

        xTrans = Math.round((x * worldMat[0][0]) + (y * worldMat[0][1]) + (z * worldMat[0][2]) +
            (worldMat[0][3]));
        yTrans = Math.round((x * worldMat[1][0]) + (y * worldMat[1][1]) + (z * worldMat[1][2]) +
            (worldMat[1][3]));
        zTrans = Math.round((x * worldMat[2][0]) + (y * worldMat[2][1]) + (z * worldMat[2][2]) +
            (worldMat[2][3]));

        return volume.transform.voxelValue.orientation.convertIndexToOffsetNative(xTrans, yTrans, zTrans)
    } else {
        return volume.transform.voxelValue.orientation.convertIndexToOffset(x, y, z)
    }

    // let coord = viewer.worldSpace ? viewer.getIndexCoordinateAtWorld(x, y, z, new papaya.core.Coordinate(0, 0, 0)) : {x:x, y:y, z:z}
    // return volume.transform.voxelValue.orientation.convertIndexToOffset(coord.x, coord.y, coord.z)
}

let on_mouse_move = (event) => {

    let viewer = papayaContainers[1].viewer
    let selectedSlice = get_selected_slice(event)
    if(selectedSlice != viewer.mainImage) {
        set_auto_cursor()
    } else if (drawing) {
        set_brush_cursor()
    }

    if (!drawing || !dragging) {
        return
    }

    let [x, y, z] = get_cursor_position(event)

    let brush_value = parseInt(document.getElementById('brush_value').value)
    let editable_image_index = get_editable_image_index()
    let volume = editable_image_index>0 ? viewer.screenVolumes[editable_image_index].volume : viewer.volume
    draw_voxel(x, y, z, volume, selectedSlice.sliceDirection, brush_value)

    papayaContainers[1].viewer.drawViewer(true, false);
}

let on_mouse_down = (event) => {
    let viewer = papayaContainers[1].viewer
    if(viewer.isAltKeyDown && !event.altKey) {
        viewer.isAltKeyDown = false
    }
    if(!drawing && !filling || viewer.isAltKeyDown) {
        return
    }
    
    if(viewer.canvasRect == null) {
        return
    }

    let selectedSlice = get_selected_slice(event)
    if(selectedSlice != viewer.mainImage) {
        return
    }
    dragging = true
    let [x, y, z] = get_cursor_position(event)
    
    let brush_value = parseInt(document.getElementById('brush_value').value)
    adding_voxels = event.button == 0

    let editable_image_index = get_editable_image_index()
    if(editable_image_index < 0) {
        return
    }

    if(filling) {

        let fill3Dcheckbox = document.getElementById('fill3D')
        let fill3D = fill3Dcheckbox != null && fill3Dcheckbox.checked
        
        for(let i=adding_voxels?0:editable_image_index ; adding_voxels?i<viewer.screenVolumes.length:i==editable_image_index ; i++) {
            let todo = [[x, y, z]]
            let volume = viewer.screenVolumes[i].volume
            let checkbox = document.querySelector('#toggle-visibility-buttons input[type="checkbox"][data-index="'+i+'"]')
            let input_number = document.querySelector('#toggle-visibility-buttons input[type="number"][data-index="'+i+'"]')
            let image_type = checkbox != null ? checkbox.getAttribute('data-image-type') : null
            let threshold = input_number != null ? parseFloat(input_number.value) : (image_type != 'image' ? 1 : -1)

            if(checkbox != null && checkbox.checked && threshold > 0) {
                let offset = convert_coord_to_offset(x, y, z, volume)

                let offsets = new Set()
                if(volume.imageData.data[offset] >= threshold) {
                    offsets.add(offset)
                    while(todo.length > 0) {
                        flood_fill(todo, offsets, threshold, i, selectedSlice.sliceDirection, brush_value, fill3D)
                    }
                }
            }

        }
        viewer.drawViewer(true, false);

    } else {
        let volume = editable_image_index>0 ? viewer.screenVolumes[editable_image_index].volume : viewer.volume
        draw_voxel(x, y, z, volume, selectedSlice.sliceDirection, brush_value)
    }

    viewer.drawViewer(true, false);
}

let on_mouse_up = (event) => {
    dragging = false
}

let go_to_world_coordinates = (loc) => {
    var coord = new papaya.core.Coordinate();
    papayaContainers[0].viewer.getIndexCoordinateAtWorld(-loc[0], -loc[1], loc[2], coord);
    papayaContainers[0].viewer.gotoCoordinate(coord)
}

let go_to_voxel_coordinates = (loc) => {
    var coord = new papaya.core.Coordinate();
    coord.x = loc[0];
    coord.y = loc[1];
    coord.z = loc[2];
    papayaContainers[0].viewer.gotoCoordinate(coord)
}

let lesion_location_to_voxel_coordinates = (loc) => {
    if(typeof(loc) == 'string') {
        loc = JSON.parse(loc)
    }
    let orientation = papayaContainers[0].viewer.screenVolumes[0].volume.header.orientation.orientation
    if(!orientation.startsWith('XYZ')) {
        console.log('Warning, image orientation is not XYZ')
    }
    let xDim = papayaContainers[0].viewer.volume.getXDim() - 1
    let yDim = papayaContainers[0].viewer.volume.getYDim() - 1
    let zDim = papayaContainers[0].viewer.volume.getZDim() - 1
    let xIndex = orientation.indexOf('X')
    let yIndex = orientation.indexOf('Y')
    let zIndex = orientation.indexOf('Z')
    let invertX = orientation[3+xIndex] == '-'
    let invertY = orientation[3+yIndex] == '+'
    let invertZ = orientation[3+zIndex] == '+'
    return [invertX ? xDim - loc[xIndex] : loc[xIndex], invertY ? yDim - loc[yIndex] : loc[yIndex], invertZ ? zDim - loc[zIndex] : loc[zIndex]]
}

let go_to_lesion = (lesion) => {
    let loc = lesion_location_to_voxel_coordinates(lesion['location_voxel'])
    console.log(loc)
    go_to_voxel_coordinates(loc)
    // loc = lesion['location']
    // go_to_world_coordinates([loc[0], loc[1], loc[2]])
}

let capitalize_first_letter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

let load_lesion = (i) => {
    current_lesion_index = i;
    if (current_lesion_index < 0) {
        current_lesion_index = lesions.length - 1;
    }
    if (current_lesion_index >= lesions.length) {
        current_lesion_index = 0;
    }

    let lesion = lesions[current_lesion_index]
    let comment = document.getElementById('comment_value');
    let valid = document.getElementById('valid_value');
    comment.value = lesion.comment != null ? lesion.comment : ''
    valid.checked = lesion.valid != null ? lesion.valid : false
    valid.indeterminate = lesion.valid == null

    if (task.fields != null) {
        let fields_element = document.getElementById('fields')
        while (fields_element.hasChildNodes()) {
            fields_element.firstChild.remove()
        }
        for (let field of task.fields) {
            let field_name = field.field || field.name
            let field_container = document.createElement('div')
            field_container.classList.add('flex-wrap')
            let fiel_label = document.createElement('label')
            fiel_label.innerText = capitalize_first_letter(field_name) + ':'
            let field_span = null
            if (field.list || field.lv_list) {
                field_span = document.createElement('ul')
                field_span.style = 'max-height: 200px; overflow: auto;'
                let list = JSON.parse(lesion[field_name].replaceAll("'", '"'))
                for (let item of list) {
                    let li = document.createElement('li')
                    li.innerText = item
                    field_span.appendChild(li)
                }
            } else if (field.editable && field.lv_type == 'bool') {
                field_span = document.createElement('input');
                field_span.setAttribute('type', 'checkbox')
                field_span.setAttribute('data-field-name', field_name)
                field_span.checked = lesion[field_name]
                field_span.disabled = false
                field_span.addEventListener('change', (event) => {
                    let lesion = lesions[current_lesion_index]
                    let field_name = event.target.getAttribute('data-field-name')
                    lesion[field_name] = event.target.checked
                    set_data_selected_row(field_name, event.target.checked)
                })
            } else {
                field_span = document.createElement('span')
                field_span.innerText = lesion[field_name]
            }
            field_span.id = field_name + '_value'
            field_container.appendChild(fiel_label)
            field_container.appendChild(field_span)
            fields_element.appendChild(field_container)
        }
    }

    let image_descriptions = lesion['images']

    let image_parameters = []

    let need_to_load = false

    for (let image_description of image_descriptions) {
        if (loaded_images.length == 0 || loaded_images.findIndex((i) => i.file_name.split('/').at(-1) == image_description.file) < 0) {
            need_to_load = true;
            break
        }
    }

    let editable_image_index = get_editable_image_index()
    let draw_tools = document.getElementById('draw_tools')
    if(editable_image_index >= 0) {
        draw_tools.classList.remove('hide')
    } else {
        draw_tools.classList.add('hide')
    }

    if(need_to_load && segmentation_is_modified) {
        save_new_segmentation()
        load_lesion(current_lesion_index)
        return
    }

    let description = document.getElementById('description')

    if (!need_to_load) {
        go_to_lesion(lesion)
        description.innerText = `${lesion['name']} - ${current_lesion_index + 1}/${lesions.length}`
        return
    }

    // if(image_descriptions.length < 8) {
    //     let image_description = window.structuredClone(image_descriptions[image_descriptions.length-1])
    //     image_description.name = 'new_segmentation'
    //     // image_descriptions.push(image_description)
    //     image_descriptions = image_descriptions.concat([image_description])
    // } else {
    //     alert('There are 8 or more images to load, cannot display new_segmentation image on top because of Papaya.js limitation.')
    // }


    description.innerText = 'loading ' + lesion['name'] + '...'
    
    let visibility_checkboxes = document.getElementById('toggle-visibility-buttons')
    visibility_checkboxes.replaceChildren();

    show_loader()

    let image_names = []
    let ni = 0
    for (let image_description of image_descriptions) {
        if (ni>=11) {
            break
        }
        ni++
        
        let file_name = image_archive != null ? Object.keys(image_archive.files).find((f) => f.split('/').at(-1) == image_description.file) : image_description.file

        image_names.push(file_name)
        image_parameters.push({ name: image_description.name, 
            file_name: file_name, 
            parameters: image_description.parameters, 
            display: image_description.display, 
            threshold_slider: image_description.threshold_slider,
            exclusive_button: image_description.exclusive_button,
            editable: image_description.editable,
            image_type: image_description.image_type
            // fill_button: image_description.fill_button
        })
    }
    if(images_url != null) {
        load_lesion_viewer(image_names, image_parameters, lesion, current_lesion_index)
        return
    }
    if(image_files != null && image_archive == null) {
        images_to_display = image_names.map((file_name) => { return [...image_files].find((f) => f.name == file_name) })
        // for all images_to_display which have a size of 0: remove them from images_to_display and image_parameters
        images_to_display = images_to_display.filter((image) => image.size != 0)
        image_parameters = image_parameters.filter((parameter) => images_to_display.findIndex((file) => file.name == parameter.file_name) >= 0)
        load_lesion_viewer(images_to_display, image_parameters, lesion, current_lesion_index)
        return
    }
    let promises = image_names.map((image_name) => { return image_archive.file(image_name).async('base64')} )
    Promise.all(promises).then((images) => load_lesion_viewer(images, image_parameters, lesion, current_lesion_index))
}

let create_table = () => {
    let rowData = []
    let i = 0
    for (let lesion of lesions) {
        data = { name: lesion.name, description: lesion.description, comment: lesion.comment, valid: lesion.valid }

        if (task.fields != null) {
            for (let field of task.fields) {
                let field_name = field.field || field.name
                data[field_name] = lesion[field_name]
            }
        }
        rowData.push(data)

    }

    // specify the columns
    let columnDefs = [
        { field: 'name', sortable: true, filter: true, width: 150, resizable: true },
        { field: 'description', sortable: true, filter: true, flex: true, resizable: true },
        // { field: 'n_methods_which_detected_lesion', sortable: true, resizable: true, filter: 'agNumberColumnFilter' },
    ];

    if (task.fields != null) {
        for (let field of task.fields) {
            if (field.field == null && field.name != null) { // retro compatibility
                field.field = field.name
            }
            
            if(field.editable && field.lv_type == 'bool') {
                field.cellRenderer = 'checkboxRenderer'
            }
            columnDefs.push(field)
        }
    }
    columnDefs.push({ field: 'valid', sortable: true, filter: true, resizable: true, editable: true, cellRenderer: 'checkboxRenderer' })
    columnDefs.push({ field: 'comment', sortable: true, filter: true, resizable: true, editable: true })

    // let the grid know which columns and what data to use
    const gridOptions = {
        columnDefs: columnDefs,
        rowSelection: 'single',
        rowData: rowData,
        onRowSelected: (event) => {
            if (!event.node.isSelected()) {
                return
            }
            let lesion_index = lesions.findIndex((lesion) => lesion.name == event.data.name)
            load_lesion(lesion_index)
        },
        components: { checkboxRenderer: CheckboxRenderer },
        onCellValueChanged: (event)=> {
            let field_name = event.colDef.field
            let lesion_index = lesions.findIndex((lesion) => lesion.name == event.data.name)
            let lesion = lesions[lesion_index]
            lesion[field_name] = event.value
            let element = document.getElementById(field_name + '_value')
            if(lesion_index == current_lesion_index &&  element != null) {
                // could check element.tagName
                element.innerText = lesion[field_name]
                element.value = lesion[field_name]
                element.checked = lesion[field_name]
                element.indeterminate = false
            }
            save_to_local_storage()
        }
        // columnTypes: { numberColumn: { width: 100, filter: 'agNumberColumnFilter' } }
    };


    if (grid != null) {
        grid.destroy()
    }
    const eGridDiv = document.querySelector('#plot_div');

    // create the grid passing in the div to use together with the columns & data we want to use
    grid = new agGrid.Grid(eGridDiv, gridOptions);
    grid.gridOptions.api.sizeColumnsToFit();

}

let resize_viewer = (container) => {

    let papaya_containers = document.getElementById('papaya-containers')
    let papaya_container0 = document.getElementById('papaya-container0')
    let papaya_container1 = document.getElementById('papaya-container1')
    let viewer_ratio = 1.5

    let padding_height = papayaContainers.length > 0 ? papayaContainers[1].containerHtml.height() - papayaContainers[1].getViewerDimensions()[1] : 0
    
    if (container == null) {
        container = {}
        container.width = window.innerWidth - 250 - 16
        container.height = window.innerHeight - padding_height
    }

    let container_ratio = container.width / container.height
    
    let side_by_side = !papaya_container0.classList.contains('hide')
    if(side_by_side) {


        if (container_ratio > viewer_ratio) {

            if (container_ratio > 2 * viewer_ratio) {
                // Very horizontal
                papaya_container0.style.height = '' + (container.height) + 'px'
                papaya_container0.style.width = '' + (container.height * viewer_ratio) + 'px'
                papaya_container0.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_container1.style.height = '' + (container.height)+ 'px'
                papaya_container1.style.width = '' + (container.height * viewer_ratio) + 'px'
                papaya_container1.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_containers.classList.replace('column', 'row')
            } else {
                // Horizontal
                papaya_container0.style.width = '' + (container.width / 2) + 'px'
                papaya_container0.style.height = '' + (0.5 * container.width / viewer_ratio) + 'px'
                papaya_container0.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_container1.style.width = '' + (container.width / 2) + 'px'
                papaya_container1.style.height = '' + (0.5 * container.width / viewer_ratio) + 'px'
                papaya_container1.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_containers.classList.replace('column', 'row')
            }
    
        } else {

            container.height -= padding_height
            container_ratio = container.width / container.height
    
            if (container_ratio < viewer_ratio / 2) {
                // Very vertical
                papaya_container0.style.width = '' + (container.width) + 'px'
                papaya_container0.style.height = '' + (container.width / viewer_ratio) + 'px'
                papaya_container0.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_container1.style.width = '' + (container.width) + 'px'
                papaya_container1.style.height = '' + ( container.width / viewer_ratio) + 'px'
                papaya_container1.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_containers.classList.replace('row', 'column')
            } else {
                // Vertical
                papaya_container0.style.height = '' + (container.height / 2) + 'px'
                papaya_container0.style.width = '' + (container.height * viewer_ratio/2) + 'px'
                papaya_container0.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_container1.style.height = '' + (container.height / 2) + 'px'
                papaya_container1.style.width = '' + (container.height * viewer_ratio/2) + 'px'
                papaya_container1.style['margin-bottom'] = '' + padding_height + 'px'
                papaya_containers.classList.replace('row', 'column')
            }
        }
    } else {
        
        if (container_ratio > viewer_ratio) {
            papaya_container1.style.height = '' + (container.height) + 'px'
            papaya_container1.style.width = '' + (container.height * viewer_ratio) + 'px'
        } else {
            papaya_container1.style.width = '' + (container.width) + 'px'
            papaya_container1.style.height = '' + (container.width / viewer_ratio) + 'px'
        }
        papaya_container1.style['margin-bottom'] = '' + padding_height + 'px'
    }
    setTimeout(() => papaya.Container.resizePapaya(), 250)
}
// resize_viewer({innerWidth: 400, innerHeight: 400})
window.addEventListener('resize', function (event) {
    resize_viewer()
})

let load_lesions = (l) => {
    loaded_images = []
    lesions = l
    if (lesions.length > 0) {
        load_from_local_storage()
        let viewer_container = document.getElementById('viewer-container')
        viewer_container.classList.remove('hide')
        create_table()
        resize_viewer()
        grid.gridOptions.api.selectIndex(0)
    } else {
        console.log('no lesions found')
    }
}

let load_task = (task_json) => {
    if (task_json instanceof Array) {
        task.lesions = task_json
        load_lesions(task_json)
    } else if (task_json.lesions instanceof Array) {
        task = task_json
        load_lesions(task_json.lesions)
    }
}

function CheckboxRenderer() { }

CheckboxRenderer.prototype.init = function (params) {
    this.params = params;

    this.eGui = document.createElement('input');
    this.eGui.type = 'checkbox';
    this.eGui.checked = params.value;

    this.checkedHandler = this.checkedHandler.bind(this);
    this.eGui.addEventListener('click', this.checkedHandler);
}

CheckboxRenderer.prototype.checkedHandler = function (e) {
    let checked = e.target.checked;
    let colId = this.params.column.colId;
    this.params.node.setDataValue(colId, checked);
    // let lesion_index = lesions.findIndex((lesion) => lesion.name == this.params.data.name)
    // let lesion = lesions[lesion_index]
    // lesion[colId] = checked
    // save_to_local_storage()
    // let checkbox_element = document.getElementById(colId + '_value')
    // checkbox_element.value = checked
    // checkbox_element.indeterminate = false
    // checkbox_element.innerText = checked
}

CheckboxRenderer.prototype.getGui = function (params) {
    return this.eGui;
}

CheckboxRenderer.prototype.destroy = function (params) {
    this.eGui.removeEventListener('click', this.checkedHandler);
}

let shiny_is_defined = ()=> {
    return typeof Shiny !== 'undefined'
}

let save_to_local_storage = ()=> {
    if(lesions == null) {
        return
    }
    let lesions_string = JSON.stringify(lesions)
    localStorage.setItem(task != null && task.name ? task.name : 'lesions', lesions_string)

    if(shiny_is_defined()) {
        Shiny.onInputChange("lesions", lesions_string);
    }

    if(window.parent != window) {
        window.parent.postMessage({task: lesions_string})
    }
}



let load_from_local_storage = ()=> {
    let lesions_string = localStorage.getItem(task != null && task.name ? task.name : 'lesions')
    if(lesions_string != null && lesions_string.length > 0) {
        let stored_lesions = JSON.parse(lesions_string)
        let stored_lesion_found = stored_lesions.findIndex((sl)=> lesions.findIndex((l)=> l.name == sl.name) >= 0) >= 0
        if(stored_lesion_found) {
            let overwrite = task != null && task.parameters != null && task.parameters.confirm_overwrite ?
            confirm('One or more lesion information was stored in this browser.\nDo you want to overwrite it?\n (Choose "Ok" to overwrite, or "Cancel" to load the selected file without browser data)') : task != null && task.parameters != null && task.parameters.ignore_local_storage ? false : true
            if(overwrite) {
                // just overwrite editable data
                for(let lesion of lesions) {
                    let stored_lesion_index = stored_lesions.findIndex((l)=> l.name == lesion.name)
                    if(stored_lesion_index < 0 || stored_lesion_index >= stored_lesions.length) {
                        continue
                    }
                    let stored_lesion = stored_lesions[stored_lesion_index]
                    if (task.fields != null) {
                        for (let field of task.fields) {
                            let field_name = field.field || field.name
                            if(field.editable) {
                                lesion[field_name] = stored_lesion[field_name]
                            }
                        }
                    }
                    lesion.comment = stored_lesion.comment
                    lesion.valid = stored_lesion.valid
                }
            }
        }
    }
}

let set_data_selected_row = (field_name, value)=> {
    let selected_nodes = grid.gridOptions.api.getSelectedNodes()
    if(selected_nodes.length > 0) {
        let selected_node = selected_nodes[0]
        selected_node.setDataValue(field_name, value)
    }
}

let toggle_crosshairs = () => {
    for(let i=0 ; i<2 ; i++) {
        papayaContainers[i].preferences.showCrosshairs = papayaContainers[i].preferences.showCrosshairs == 'Yes' ? 'No' : 'Yes'
        papayaContainers[i].viewer.drawViewer()
    }
}

async function loadFilesFromServer() {
    const response = await fetch("/data/task.json");

    try {
        const json = await response.json();
        images_url = '/data/'
        load_task(json)
    } catch (e) {
        console.log(e);
    }
}

let add_close_button = ()=> {
    let close_button = document.getElementById('close_lesion_viewer')
    if(close_button != null) {
        return
    }
    close_button = document.createElement('button')
    close_button.innerText = 'x' //'Close lesion viewer'
    close_button.id = 'close_lesion_viewer'
    
    close_button.addEventListener('click', (event)=>{
        if(window.parent != window) {
            window.parent.postMessage({action: 'hide'})
        }
    })
    let toolbox = document.getElementById('toolbox')
    toolbox.insertBefore(close_button, toolbox.firstChild)
}

window.onmessage = function(event) {
    if (event.data.action != null && event.data.action == 'show') {
        add_close_button()
        resize_viewer()
    }
    if (event.data.task != null) {
        images_url = '/data/'
        load_task(event.data.task)
    }
};

document.addEventListener('DOMContentLoaded', function (event) {
    
    let body = document.querySelector('body')
    if(body.firstChild.nodeType == document.TEXT_NODE && body.firstChild.textContent.indexOf('{{ base_href }}') >= 0) {
        body.firstChild.remove()
    }

    let lesion_viewer_container = document.getElementById('lesion-viewer-container')
    
    const attrObserver = new MutationObserver((mutations) => {
        mutations.forEach(mu => {
            if (mu.type !== "attributes" && mu.attributeName !== "class") return;
            if(!mu.target.classList.contains('hide')){
                resize_viewer();
            }
        });
    });
    attrObserver.observe(lesion_viewer_container, {attributes: true})
      
    if(shiny_is_defined()) {
        lesion_viewer_container.classList.add('hide')
        console.log(lesion_viewer_container, lesion_viewer_container.classList)
        add_close_button()
    }

    let papaya_container0 = document.getElementById('papaya-container0')

    let side_by_side = localStorage.getItem('side-by-side')
    if (side_by_side == 'true') {
        papaya_container0.classList.remove('hide')
    } else {
        papaya_container0.classList.add('hide')
    }

    resize_viewer()


    for(let i=0 ; i<2 ; i++) {
        let papaya_container = document.getElementById('papaya-container' + i)
        papaya_container.addEventListener('wheel', (event) => {
            event.preventDefault()
        })
    }
    
    let side_by_side_button = document.getElementById('side-by-side')
    side_by_side_button.addEventListener('click', () => {
        if(papaya_container0.classList.contains('hide')) {
            papaya_container0.classList.remove('hide')
        } else {
            papaya_container0.classList.add('hide')
        }
        localStorage.setItem('side-by-side', !papaya_container0.classList.contains('hide'))
        resize_viewer()
    })

    $('a[data-value="Lesion viewer"]').click((event)=> {
        setTimeout(()=>resize_viewer(), 500)
    })

    // let load_lesions_data = document.getElementById('load_lesions_data')
    // load_lesions_data.onchange = function () {
    //     let file = this.files[0]
    //     const objectURL = URL.createObjectURL(file)
    //     dfd.read_csv(objectURL).then((df)=> {
    //         load_lesions(df.to_json({ download: false }))
    //     }).catch(err => {
    //         console.log(err)
    //     })
    // }

    let load_task_description = document.getElementById('load_task_description')
    load_task_description.onchange = function () {
        if (this.files.length == 0) {
            return
        }
        let file = this.files[0]
        let file_reader = new FileReader();
        file_reader.onload = (event) => load_task(JSON.parse(event.target.result))
        file_reader.readAsText(file, 'UTF-8')
    }

    let load_image_archives = document.getElementById('load_images_archive')

    load_image_archives.onchange = function () {
        if (this.files.length == 0) {
            return
        }
        var zip = new JSZip();
        zip.loadAsync(this.files[0] /* = file blob */)
            .then(function (local_zip) {
                images_url = null
                image_archive = local_zip;
                for (let file in image_archive.files) {
                    if (file.endsWith('.json')) {
                        return image_archive.file(file).async('text')
                    }
                }

            }).then(function (result) {
                if (result) {
                    load_task(JSON.parse(result))
                } else {
                    console.log('lesions.json not found')
                }
            })
    };

    let load_images = document.getElementById('load_images')

    load_images.onchange = function () {
        if (this.files.length == 0) {
            return
        }
        images_url = null
        image_files = this.files
    };

    

    let comment = document.getElementById('comment_value');
    comment.addEventListener('change', () => {
        let lesion = lesions[current_lesion_index]
        lesion.comment = comment.value
        set_data_selected_row('comment', lesion.comment)
    })

    let valid = document.getElementById('valid_value');
    valid.addEventListener('change', () => {
        let lesion = lesions[current_lesion_index]
        lesion.valid = valid.checked
        set_data_selected_row('valid', lesion.valid)
    })

    let save_task_button = document.getElementById('save_task');
    save_task_button.addEventListener('click', () => {
        // task.lesion = lesions
        downloadJSON(task, 'lesions.json')
    })

    let draw_button = document.getElementById('draw')
    let fill_button = document.getElementById('fill')

    draw_button.addEventListener('click', () => {
        if(draw_button.classList.contains('active')) {
            draw_button.classList.remove('active')
            draw_button.getElementsByTagName('span')[0].textContent = 'Draw'
            drawing = false
            set_auto_cursor()
        } else {
            draw_button.classList.add('active')
            fill_button.classList.remove('active')
            draw_button.getElementsByTagName('span')[0].textContent = 'Stop drawing'
            fill_button.getElementsByTagName('span')[0].textContent = 'Fill'
            drawing = true
            filling = false
            set_brush_cursor()
        }
    })

    fill_button.addEventListener('click', () => {
        if(fill_button.classList.contains('active')) {
            fill_button.classList.remove('active')
            fill_button.getElementsByTagName('span')[0].textContent = 'Fill'
            filling = false
        } else {
            fill_button.classList.add('active')
            draw_button.classList.remove('active')
            fill_button.getElementsByTagName('span')[0].textContent = 'Stop filling'
            draw_button.getElementsByTagName('span')[0].textContent = 'Draw'
            drawing = false
            set_auto_cursor()
            filling = true
        }
    })

    let brush_size_slider = document.getElementById('slider_brush_size')
    brush_size_slider.addEventListener('change', (event)=> {
        brush_size = parseFloat(event.target.value)
        document.getElementById('label_brush_size').textContent = brush_size
        if(drawing) {
            set_brush_cursor()
        }
    })

    let save_segmentation_button = document.getElementById('save_segmentation');
    save_segmentation_button.addEventListener('click', save_new_segmentation)

    let prev_button = document.getElementById('prev')
    prev_button.addEventListener('click', () => {
        let selected_nodes = grid.gridOptions.api.getSelectedNodes()
        let current_row = selected_nodes.length > 0 && selected_nodes[0].displayed ? selected_nodes[0].rowIndex - 1 : 1
        if (current_row < 0) {
            current_row = grid.gridOptions.api.getDisplayedRowCount() - 1;
        }
        grid.gridOptions.api.selectIndex(current_row)
    })

    let next_button = document.getElementById('next')
    next_button.addEventListener('click', () => {
        let selected_nodes = grid.gridOptions.api.getSelectedNodes()
        let current_row = selected_nodes.length > 0 && selected_nodes[0].displayed ? grid.gridOptions.api.getSelectedNodes()[0].rowIndex + 1 : -1
        if (current_row >= grid.gridOptions.api.getDisplayedRowCount()) {
            current_row = 0;
        }
        grid.gridOptions.api.selectIndex(current_row)
    })

    let go_to_lesion_button = document.getElementById('go-to-lesion')
    go_to_lesion_button.addEventListener('click', () => {
        go_to_lesion(lesions[current_lesion_index])
    })

    let toggle_crosshairs_button = document.getElementById('toggle-crosshairs')
    toggle_crosshairs_button.addEventListener('click', toggle_crosshairs)

    loadFilesFromServer();

    document.getElementById('papaya-containers').addEventListener('click', (event)=> {
        document.activeElement.blur()
    })


    document.addEventListener('keyup', (event)=> {
        let toolbox = document.getElementById('toolbox')
        let plot_div = document.getElementById('plot_div')
        if(toolbox.contains(document.activeElement) || plot_div.contains(document.activeElement)) {
            return
        }
        let n = parseInt(event.key)
        if(Number.isInteger(n)) {
            toggle_image(n)
        }
        if(event.key == '*') {
            toggle_image(loaded_images.length-1)
        }
        if(event.key == '-') {
            while(current_image_index > 0 && papayaContainers[1].viewer.screenVolumes[current_image_index].hidden) {
                current_image_index--
            }
            toggle_image(current_image_index)
        }
        if(event.key == '+') {
            while(current_image_index < loaded_images.length-1 && !papayaContainers[1].viewer.screenVolumes[current_image_index].hidden) {
                current_image_index++
            }
            toggle_image(current_image_index)
        }
        if(event.key == 'c') {
            toggle_crosshairs()
        }
    })
});

// Draw test

const downloadJSON = (json, fileName) => {
    let string = JSON.stringify(json, null, '\t')

    var data_string = 'data:text/json;charset=utf-8,' + encodeURIComponent(string);
    var download_node = document.createElement('a');
    download_node.setAttribute('href', data_string);
    download_node.setAttribute('download', fileName);
    document.body.appendChild(download_node); // required for firefox
    download_node.click();
    download_node.remove();
}

const downloadURL = (data, fileName) => {
    const a = document.createElement('a')
    a.href = data
    a.download = fileName
    document.body.appendChild(a)
    a.style.display = 'none'
    a.click()
    a.remove()
}

const downloadBlob = (data, fileName, mimeType) => {

    const blob = new Blob([data], {
        type: mimeType
    })

    const url = window.URL.createObjectURL(blob)

    downloadURL(url, fileName)

    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

// let write_test_volume = (data) => {
//     for (let i = 0; i < data.length; i++) {
//         data[i] = i % 255
//     }
// }

// write_test_volume(data)
// let canvas = papayaContainers[0].viewer.canvas
// canvas.addEventListener('mousemove', this.on_mouse_move, false);
// canvas.addEventListener('mousedown', this.on_mouse_down, false);
// // canvas.addEventListener('mouseout', this.listenerMouseOut, false);
// // canvas.addEventListener('mouseleave', this.listenerMouseLeave, false);
// canvas.addEventListener('mouseup', this.on_mouse_up, false);

let toggle_image = (n)=> {
    if(n < 0 || n >= loaded_images.length) {
        return
    }
    checkbox_id = 'checkbox_' + loaded_images[n].display_name
    checkbox = document.getElementById(checkbox_id)
    if(checkbox) {
        checkbox.click()
    }
}