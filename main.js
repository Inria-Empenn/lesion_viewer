// Remove smooth display:
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'smoothDisplay', 'No', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'showOrientation', 'Yes', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);
papaya.viewer.Viewer.MAX_OVERLAYS = 12;

// To draw / change the data of a volume:
// papayaContainers[0].viewer.screenVolumes[3].volume.imageData.data[i] = 1

let validation = localStorage.getItem('validation');
validation = validation != null ? JSON.parse(validation) : {};
papaya.Container.atlasWorldSpace = false
var params = [];

params["images"] = [];

let current_lesion_index = 0;

let image_archive = null;
let task = {};
let lesions = [];
let toggle_buttons = [];
let grid = null;
let initialized = false;
let segmentation_data = null;

let show_loader = () => {
    let loader = document.getElementById('loader')
    loader.classList.remove('hide')
}

let hide_loader = () => {
    let loader = document.getElementById('loader')
    loader.classList.add('hide')
}

let create_toggle_button = (button_name, image_index, visible) => {
    let container = document.getElementById('toggle-visibility-buttons')
    let toggle_button = document.createElement("button");
    toggle_button.innerHTML = visible ? "Hide " + button_name : "Show " + button_name;
    container.appendChild(toggle_button);
    toggle_button.setAttribute('data-visible', visible ? 'true' : 'false')
    toggle_button.addEventListener('click', () => {
        let visible = toggle_button.getAttribute('data-visible')
        if (visible == 'true') {
            papaya.Container.hideImage(0, image_index)
            toggle_button.innerHTML = "Show " + button_name
            toggle_button.setAttribute('data-visible', 'false')
        } else {
            papaya.Container.showImage(0, image_index)
            toggle_button.innerHTML = "Hide " + button_name
            toggle_button.setAttribute('data-visible', 'true')
        }
    })
    toggle_buttons.push(toggle_button)
}

let loaded_images = []

let load_lesion_viewer = (images, image_parameters, lesion, lesion_index) => {

    for (let li of loaded_images) {
        delete window[li.name]
    }
    loaded_images = []

    // let new_loaded_images = []
    // for(let li of loaded_images) {
    //     if(image_parameters.findIndex((ip)=>ip.file_name==li.file_name)){
    //         papaya.Container.removeImage(0, li.index)
    //         delete window[li.name]
    //     } else {
    //         new_loaded_images.push(li)
    //     }
    // }
    // loaded_images = new_loaded_images

    params = {}
    params['encodedImages'] = []

    let image_index = 0;
    // let screen_volumes = []
    for (let image_parameter of image_parameters) {

        // if(loaded_images.findIndex((li)=>li.file_name==image_parameter.file_name)){
        //     continue
        // } else {
        //     image_parameter.parameters.max = image_parameter.parameters.max != null && image_parameter.parameters.max == 1 ? 2 : image_parameter.parameters.max
        //     papaya.Container.addImage(0, images[image_parameters.promise_index], image_parameter.parameters)
        // }

        // params['t0'] = {"min": 0, "max": 1, "lut": "Red Overlay"};
        let file_name = image_parameter.file_name
        let parameters = image_parameter.parameters
        let image_name = 'lesion_viewer_' + file_name.replace('/', '_').replace('.nii.gz', '')
        params['encodedImages'].push(image_name)
        window[image_name] = images[image_index]
        loaded_images.push({ name: image_name, file_name: file_name, index: image_index })
        // parameters['interpolation'] = false
        params[image_name] = parameters
        // params[file_name] = image_parameters[key]
        create_toggle_button(file_name.split('/').at(-1), image_index, image_parameter.display)
        image_parameter.image_index = image_index
        // for(let i=0 ; i<papayaContainers[0].viewer.screenVolumes.length ; i++) {
        //     if(papayaContainers[0].viewer.screenVolumes[i].volume.fileName == image_name) {
        //         screen_volumes.push(papayaContainers[0].viewer.screenVolumes[i])
        //     }
        // }
        image_index++
    }
    // Reorder
    // papayaContainers[0].viewer.screenVolumes = screen_volumes
    // let i3 = params['encodedImages'][3]
    // params['encodedImages'][3] = params['encodedImages'][2]
    // params['encodedImages'][2] = i3

    params['worldSpace'] = false
    // loc = lesion['location']
    // params['coordinate'] = [loc[2], loc[1], loc[0]]
    params['coordinate'] = lesion['location_voxel'] // [-loc[0], -loc[1], loc[2]]
    params['smoothDisplay'] = false
    params['ignoreNiftiTransforms'] = true
    // params['syncOverlaySeries'] = false
    params['loadingComplete'] = () => {
        go_to_lesion(lesions[current_lesion_index])
        for (let image_parameter of image_parameters) {
            if(image_parameter.display != null && !image_parameter.display) {
                papaya.Container.hideImage(0, image_parameter.image_index)
            }
        }
        // let sv = papayaContainers[0].viewer.screenVolumes
        // let volume = sv[sv.length - 1].volume
        // let data = volume.imageData.data
        // for (let i = 0; i < data.length; i++) {
        //     // data[i] = 0
        // }
        // segmentation_data = data
        // papayaContainers[0].viewer.drawViewer(true, false);
    }

    let description = document.getElementById('description')
    description.innerText = `${lesion['name']} - ${lesion_index + 1}/${lesions.length}`

    papaya.Container.resetViewer(0, params);

    hide_loader()

    // if (!initialized) {
    //     initialized = true;
        // let canvas = papayaContainers[0].viewer.canvas
        // canvas.addEventListener("mousemove", listenerMouseMove, false);
        // canvas.addEventListener("mousedown", listenerMouseDown, false);
        // canvas.addEventListener("mouseup", listenerMouseUp, false);
    // }
}

let dragging = false

let listenerMouseMove = (event) => {
    if (dragging) {

        let viewer = papayaContainers[0].viewer
        let currentMouseX = papaya.utilities.PlatformUtils.getMousePositionX(event);
        let currentMouseY = papaya.utilities.PlatformUtils.getMousePositionY(event);

        // let x = viewer.convertScreenToImageCoordinateX(currentMouseX - viewer.canvasRect.left, viewer.selectedSlice);
        // let y = viewer.convertScreenToImageCoordinateY(currentMouseY - viewer.canvasRect.top, viewer.selectedSlice);
        // let coord = viewer.convertCurrentCoordinateToScreen(viewer.selectedSlice);
        let x = viewer.currentCoord.x
        let y = viewer.currentCoord.y
        let z = viewer.selectedSlice.currentSlice;
        console.log(x, y, z)
        let sv = papayaContainers[0].viewer.screenVolumes
        let volume = sv[sv.length - 1].volume

        let viewer_volume = papayaContainers[0].viewer.volume
        // let xDim = viewer_volume.getXDim()
        // let yDim = viewer_volume.getYDim()
        // let zDim = viewer_volume.getZDim()
        // let offset = papayaContainers[0].viewer.volume.transform.voxelValue.orientation.convertIndexToOffset(coord.x, coord.y, coord.z)
        let offset = papayaContainers[0].viewer.volume.transform.voxelValue.orientation.convertIndexToOffset(x, y, z)
        console.log(offset)
        // let offset = papayaContainers[0].viewer.volume.transform.voxelValue.orientation.convertIndexToOffsetNative(x, y, z)
        segmentation_data[offset] = !segmentation_data[offset]
        // console.log(!segmentation_data[offset])
        // let index = ((y * xDim) + x) * 4;
        // for (let i = 0; i < segmentation_data.length; i++) {
        //     segmentation_data[i] = i % 5
        // }
        // segmentation_data[x+y*xDim+z*xDim*yDim] = 1
        // segmentation_data[z+y*zDim+x*zDim*yDim] = 1
        // segmentation_data[y+x*yDim+z*xDim*yDim] = 1

        papayaContainers[0].viewer.drawViewer(true, false);
    }
}

let listenerMouseDown = (event) => {
    dragging = true
}

let listenerMouseUp = (event) => {
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
    let xDim = papayaContainers[0].viewer.volume.getXDim() - 1
    let yDim = papayaContainers[0].viewer.volume.getYDim() - 1
    let zDim = papayaContainers[0].viewer.volume.getZDim() - 1
    return [xDim-loc[0], yDim-loc[1], zDim-loc[2]]
}

let go_to_lesion = (lesion) => {
    let loc = lesion_location_to_voxel_coordinates(lesion['location_voxel'])
    console.log(loc)
    go_to_voxel_coordinates(loc)
    // loc = lesion['location']
    // go_to_world_coordinates([loc[0], loc[1], loc[2]])
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
    let info = validation[lesion['name']];
    let comment = document.getElementById('comment');
    let valid = document.getElementById('valid');
    comment.value = info ? info['comment'] : ''
    valid.checked = info ? info['valid'] : false
    valid.indeterminate = info == null

    if (task.fields != null) {
        let fields_element = document.getElementById('fields')
        while (fields_element.hasChildNodes()) {
            fields_element.firstChild.remove()
        }
        for (let field of task.fields) {
            let field_container = document.createElement('div')
            let fiel_label = document.createElement('label')
            fiel_label.innerText = field.name + ':'
            let field_span = null
            if(field.list) {
                field_span = document.createElement('ul')
                field_span.style = 'max-height: 200px; overflow: auto;'
                let list = JSON.parse(lesion[field.name].replaceAll("'", '"'))
                for(let item of list) {
                    let li = document.createElement('li')
                    li.innerText = item
                    field_span.appendChild(li)
                }
            } else {
                field_span = document.createElement('span')
                field_span.innerText = lesion[field.name]
            }
            field_container.appendChild(fiel_label)
            field_container.appendChild(field_span)
            fields_element.appendChild(field_container)
        }
    }

    let image_descriptions = lesion['images']

    let promises = []
    let image_parameters = []

    let need_to_load = false

    for (let image_description of image_descriptions) {
        if (loaded_images.length == 0 || loaded_images.findIndex((i) => i.file_name.split('/').at(-1) == image_description.file) < 0) {
            need_to_load = true;
            break
        }
    }

    let description = document.getElementById('description')

    if (!need_to_load) {
        go_to_lesion(lesion)
        description.innerText = `${lesion['name']} - ${current_lesion_index + 1}/${lesions.length}`
        return
    }

    // if(image_descriptions.length < 8) {
    //     image_descriptions.push(image_descriptions[image_descriptions.length-1])
    // }

    for (let image_description of image_descriptions) {
        let file_name = image_description.file
        for (let f in image_archive.files) {
            if (f.split('/').at(-1) == file_name) {
                file_name = f
                break
            }
        }
        // let promise_index = -1
        // if(loaded_images.findIndex((i)=>i.file_name == file_name)<0) {
        //     promise_index = promises.length
        // }

        promises.push(image_archive.file(file_name).async("base64"))
        image_parameters.push({ file_name: file_name, parameters: image_description.parameters, display: image_description.display })
    }

    description.innerText = 'loading ' + lesion['name'] + '...'

    for (let tb of toggle_buttons) {
        tb.remove();
    }

    show_loader()

    Promise.all(promises).then((images) => load_lesion_viewer(images, image_parameters, lesion, current_lesion_index))
}

let save_validation = () => {
    localStorage.setItem(JSON.stringify(validation))
}

let create_table = () => {
    let table = { 'name': [], 'description': [], 'comment': [], 'valid': [] }
    // let values = []
    let rowData = []
    let i = 0
    for (let lesion of lesions) {
        table['name'].push(lesion.name)
        table['description'].push(lesion.description)
        let info = validation[lesion.name];
        if (info != null) {
            table['comment'].push(info['comment'])
            table['valid'].push(info['valid'])
        } else {
            table['comment'].push('')
            table['valid'].push('')
        }
        data = { name: lesion.name, description: lesion.description }

        if (task.fields != null) {
            for (let field of task.fields) {
                data[field.name] = lesion[field.name]
            }
        }
        rowData.push(data)

    }
    // let df = new dfd.DataFrame(table)
    // df.plot("plot_div").table()

    // values = [table.name, table.description, table.comment, table.valid]
    // var data = [{
    //     type: 'table',
    //     header: { values: [["<b>Name</b>"], ["<b>Description</b>"], ["<b>Comment</b>"], ["<b>Valid</b>"]], },
    //     cells: { values: values }
    // }]

    // Plotly.newPlot('plot_div', data);

    // plot_div.on('plotly_click', function(data){
    //     console.log(data)
    // });


    // specify the columns
    let columnDefs = [
        { field: "name", sortable: true, filter: true, width: 150, resizable: true },
        { field: "description", sortable: true, filter: true, flex: true, resizable: true },
        // { field: "n_methods_which_detected_lesion", sortable: true, resizable: true, filter: 'agNumberColumnFilter' },
    ];

    if (task.fields != null) {
        for (let field of task.fields) {
            columnDefs.push({ field: field.name, sortable: field.sortable, resizable: field.resizable, filter: field.filter })
        }
    }

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

        // columnTypes: { numberColumn: { width: 100, filter: 'agNumberColumnFilter' } }
    };


    if(grid != null) {
        grid.destroy()
    }
    const eGridDiv = document.querySelector('#plot_div');

    // create the grid passing in the div to use together with the columns & data we want to use
    grid = new agGrid.Grid(eGridDiv, gridOptions);
    grid.gridOptions.api.sizeColumnsToFit();

}

let resize_viewer = (container) => {

    let papaya_container = document.getElementById('papaya-container')
    let viewer_ratio = 1.5

    let padding_height = papayaContainers.length > 0 ? papayaContainers[0].containerHtml.height() - papayaContainers[0].getViewerDimensions()[1] : 0
    console.log(padding_height)
    if (container == null) {
        container = {}
        container.width = window.innerWidth - 250 - 16
        container.height = window.innerHeight - padding_height
    }

    let container_ratio = container.width / container.height

    if (container_ratio > viewer_ratio) {
        papaya_container.style.height = '' + container.height + 'px'
        papaya_container.style.width = '' + (container.height * viewer_ratio) + 'px'
        papaya_container.style['margin-bottom'] = '' + padding_height + 'px'
    } else {
        papaya_container.style.width = '' + container.width + 'px'
        papaya_container.style.height = '' + (container.width / viewer_ratio) + 'px'
        papaya_container.style['margin-bottom'] = '' + padding_height + 'px'
    }
    setTimeout(() => papaya.Container.resizePapaya(), 250)
}
// resize_viewer({innerWidth: 400, innerHeight: 400})
window.addEventListener("resize", function (event) {
    resize_viewer()
})

let load_lesions = (l)=> {
    lesions = l
    // let i = 0
    // for(let lesion of lesions) {
    //     for(let type of ['name', 'descritpion', 'images', 'location', 'location_voxel']) {
    //         if(lesion[type] == null && task.field_types[type] == null) {
    //             lesion[type] = i
    //         }
    //         lesion[type] = lesion[type] | lesion[task.field_names[type]]
    //     }
    //     i++
    // }
    if (lesions.length > 0) {
        let viewer_container = document.getElementById('viewer-container')
        viewer_container.classList.remove('hide')
        create_table()
        resize_viewer()
        grid.gridOptions.api.selectIndex(0)
    } else {
        console.log('no lesions found')
    }
}

let load_task = (file)=> {
    task = JSON.parse(file)
    // if(task.fields != null) {
    //     task.field_names = {}
    //     for(let field of task.fields) {
    //         task.field_names[field.type] = field.name
    //     }
    // }
    if(task instanceof Array) {
        load_lesions(task)
    } else if(task.lesions instanceof Array) {
        load_lesions(task.lesions)
    }
}

document.addEventListener("DOMContentLoaded", function (event) {
    resize_viewer()

    let papaya_container = document.getElementById('papaya-container')
    papaya_container.addEventListener('wheel', (event) => {
        event.preventDefault()
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
        if(this.files.length == 0) {
            return
        }
        let file = this.files[0]
        let file_reader = new FileReader();
        file_reader.onload = (event)=> load_task(event.target.result)
        file_reader.readAsText(file, 'UTF-8')
    }

    let load_image_archives = document.getElementById('load_images_archive')

    load_image_archives.onchange = function () {
        if(this.files.length == 0) {
            return
        }
        var zip = new JSZip();
        zip.loadAsync(this.files[0] /* = file blob */)
            .then(function (local_zip) {
                image_archive = local_zip;
                for (let file in image_archive.files) {
                    if (file.endsWith('.json')) {
                        return image_archive.file(file).async('text')
                    }
                }

            }).then(function (result) {
                if (result) {
                    load_task(result)
                } else {
                    console.log('lesions.json not found')
                }
            })
    };

    let comment = document.getElementById('comment');
    comment.addEventListener('change', () => {
        let lesion_name = lesions[current_lesion_index]['name']
        let info = validation[lesion_name];
        if (info != null) {
            info['comment'] = comment.value
        } else {
            validation[lesion_name] = { 'comment': comment.value, 'valid': null }
        }
    })

    let valid = document.getElementById('valid');
    valid.addEventListener('change', () => {
        let lesion_name = lesions[current_lesion_index]['name']
        let info = validation[lesion_name];
        if (info != null) {
            info['valid'] = valid.checked
        } else {
            validation[lesion_name] = { 'valid': valid.checked, 'comment': '' }
        }
    })

    let save = document.getElementById('save');
    save.addEventListener('click', () => {
        validation_string = JSON.stringify(validation)

        var data_string = "data:text/json;charset=utf-8," + encodeURIComponent(validation_string);
        var download_node = document.createElement('a');
        download_node.setAttribute("href", data_string);
        download_node.setAttribute("download", "validation.json");
        document.body.appendChild(download_node); // required for firefox
        download_node.click();
        download_node.remove();
    })

    let prev_button = document.getElementById('prev')
    prev_button.addEventListener('click', () => {
        let selectedNodes = grid.gridOptions.api.getSelectedNodes()
        let currentRow = selectedNodes.length > 0 && selectedNodes[0].displayed ? selectedNodes[0].rowIndex - 1 : 1
        if (currentRow < 0) {
            currentRow = grid.gridOptions.api.getDisplayedRowCount() - 1;
        }
        grid.gridOptions.api.selectIndex(currentRow)
    })

    let next_button = document.getElementById('next')
    next_button.addEventListener('click', () => {
        let selectedNodes = grid.gridOptions.api.getSelectedNodes()
        let currentRow = selectedNodes.length > 0 && selectedNodes[0].displayed ? grid.gridOptions.api.getSelectedNodes()[0].rowIndex + 1 : -1
        if (currentRow >= grid.gridOptions.api.getDisplayedRowCount()) {
            currentRow = 0;
        }
        grid.gridOptions.api.selectIndex(currentRow)
    })

    let go_to_lesion_button = document.getElementById('go-to-lesion')
    go_to_lesion_button.addEventListener('click', () => {
        go_to_lesion(lesions[current_lesion_index])
    })
});


// Draw test

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

// data = papayaContainers[0].viewer.screenVolumes[4].volume.imageData.data
// downloadBlob(data, 'test.bin', 'application/octet-stream');

let write_test_volume = (data) => {
    for (let i = 0; i < data.length; i++) {
        data[i] = i % 255
    }
}

// write_test_volume(data)
// let canvas = papayaContainers[0].viewer.canvas
// canvas.addEventListener("mousemove", this.listenerMouseMove, false);
// canvas.addEventListener("mousedown", this.listenerMouseDown, false);
// // canvas.addEventListener("mouseout", this.listenerMouseOut, false);
// // canvas.addEventListener("mouseleave", this.listenerMouseLeave, false);
// canvas.addEventListener("mouseup", this.listenerMouseUp, false);
