papaya.Container.syncViewers = true;

// Remove smooth display:
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'smoothDisplay', 'No', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'showOrientation', 'Yes', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);
papaya.viewer.Viewer.MAX_OVERLAYS = 12;

// To draw / change the data of a volume:
// papayaContainers[0].viewer.screenVolumes[3].volume.imageData.data[i] = 1

papaya.Container.atlasWorldSpace = false
var params = [];

params["images"] = [];

let current_lesion_index = 0;

let image_archive = null;
let task = {};
let lesions = [];
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

let create_checkbox = (name, image_index, visible) => {
    let container = document.getElementById('toggle-visibility-buttons')

    {/* <div>
        <label for="checkbox_name">name</label>
        <input type="checkbox" name="name" id="checkbox_name">
    </div> */}

    let div = document.createElement('div');
    div.classList.add('checkbox')
    let label = document.createElement("label");
    label.setAttribute('for', 'checkbox_' + name)
    label.innerText = name
    let input = document.createElement("input");
    input.setAttribute('type', 'checkbox')
    input.setAttribute('id', 'checkbox_' + name)
    input.setAttribute('name', name)
    input.checked = visible
    input.disabled = true
    div.appendChild(input)
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
        }
    })
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
            papaya.Container.hideImage(1, image_index)
            toggle_button.innerHTML = "Show " + button_name
            toggle_button.setAttribute('data-visible', 'false')
        } else {
            papaya.Container.showImage(1, image_index)
            toggle_button.innerHTML = "Hide " + button_name
            toggle_button.setAttribute('data-visible', 'true')
        }
    })
}

let loaded_images = []

let load_lesion_viewer = (images, image_parameters, lesion, lesion_index) => {

    for (let li of loaded_images) {
        delete window[li.name]
    }
    loaded_images = []
    params = {}
    params['encodedImages'] = []

    let image_index = 0;
    // let screen_volumes = []
    for (let image_parameter of image_parameters) {

        let file_name = image_parameter.file_name
        let parameters = image_parameter.parameters
        let image_name = 'lesion_viewer_' + file_name.replace('/', '_').replace('.nii.gz', '')
        params['encodedImages'].push(image_name)
        window[image_name] = images[image_index]
        loaded_images.push({ name: image_name, file_name: file_name, index: image_index })
        params[image_name] = parameters
        create_checkbox(image_parameter.name || file_name.split('/').at(-1), image_index, image_parameter.display)
        image_parameter.image_index = image_index
        image_index++
    }
    params['worldSpace'] = false
    params['coordinate'] = lesion['location_voxel']
    params['smoothDisplay'] = false
    params['ignoreNiftiTransforms'] = true
    params['loadingComplete'] = () => {
        go_to_lesion(lesions[current_lesion_index])
        for (let image_parameter of image_parameters) {
            if (image_parameter.display != null && !image_parameter.display) {
                papaya.Container.hideImage(1, image_parameter.image_index)
            }
        }

        let container = document.getElementById('toggle-visibility-buttons')
        let checkboxes = document.getElementsByTagName('input')
        for(let checkbox of checkboxes) {
            checkbox.disabled = false
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
    
    papaya.Container.resetViewer(1, params);
    params['encodedImages'] = [params['encodedImages'][0]]
    params['loadingComplete'] = null
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
    let orientation = papayaContainers[0].viewer.screenVolumes[0].volume.header.orientation.orientation
    if(!orientation.startsWith('XYZ')) {
        console.log('Warning, image orientation is not XYZ')
    }
    let xDim = papayaContainers[0].viewer.volume.getXDim() - 1
    let yDim = papayaContainers[0].viewer.volume.getYDim() - 1
    let zDim = papayaContainers[0].viewer.volume.getZDim() - 1
    let invertX = orientation[3] == '-'
    let invertY = orientation[4] == '+'
    let invertZ = orientation[5] == '+'
    return [invertX ? xDim - loc[0] : loc[0], invertY ? yDim - loc[1] : loc[1], invertZ ? zDim - loc[2] : loc[2]]
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
            let fiel_label = document.createElement('label')
            fiel_label.innerText = field_name + ':'
            let field_span = null
            if (field.list || field.longiseg_list) {
                field_span = document.createElement('ul')
                field_span.style = 'max-height: 200px; overflow: auto;'
                let list = JSON.parse(lesion[field_name].replaceAll("'", '"'))
                for (let item of list) {
                    let li = document.createElement('li')
                    li.innerText = item
                    field_span.appendChild(li)
                }
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
        image_parameters.push({ name: image_description.name, file_name: file_name, parameters: image_description.parameters, display: image_description.display })
    }

    description.innerText = 'loading ' + lesion['name'] + '...'
    
    let visibility_checkboxes = document.getElementById('toggle-visibility-buttons')
    visibility_checkboxes.replaceChildren();

    show_loader()

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
        { field: "name", sortable: true, filter: true, width: 150, resizable: true },
        { field: "description", sortable: true, filter: true, flex: true, resizable: true },
        // { field: "n_methods_which_detected_lesion", sortable: true, resizable: true, filter: 'agNumberColumnFilter' },
    ];

    if (task.fields != null) {
        for (let field of task.fields) {
            if (field.field == null && field.name != null) { // retro compatibility
                field.field = field.name
            }
            
            if(field.editable && field.longiseg_type == "bool") {
                field.cellRenderer = 'checkboxRenderer'
            }
            columnDefs.push(field)
        }
    }
    columnDefs.push({ field: "comment", sortable: true, filter: true, resizable: true, editable: true })
    columnDefs.push({ field: "valid", sortable: true, filter: true, resizable: true, editable: true, cellRenderer: 'checkboxRenderer' })

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
            if(element != null) {
                // could check element.tagName
                element.innerText = lesion[field_name]
                element.value = lesion[field_name]
                element.checked = lesion[field_name]
                element.indeterminate = false
            }
            save_in_local_storage()
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
window.addEventListener("resize", function (event) {
    resize_viewer()
})

let load_lesions = (l) => {
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

let load_task = (file) => {
    let task_json = JSON.parse(file)
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
    // save_in_local_storage()
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

let save_in_local_storage = ()=> {
    if(lesions == null) {
        return
    }
    let lesions_string = JSON.stringify(lesions)
    localStorage.setItem(task != null && task.name ? task.name : 'lesions', lesions_string)
}

let load_from_local_storage = ()=> {
    let lesions_string = localStorage.getItem(task != null && task.name ? task.name : 'lesions')
    if(lesions_string != null && lesions_string.length > 0) {
        let stored_lesions = JSON.parse(lesions_string)
        let stored_lesion_found = stored_lesions.findIndex((sl)=> lesions.findIndex((l)=> l.name == sl.name) >= 0) >= 0
        if(stored_lesion_found) {
            let overwrite = confirm('One or more lesion information was stored in this browser.\nDo you want to overwrite it?\n (Choose "Ok" to overwrite, or "Cancel" to load the selected file without browser data)')
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

document.addEventListener("DOMContentLoaded", function (event) {
    resize_viewer()

    for(let i=0 ; i<2 ; i++) {
        let papaya_container = document.getElementById('papaya-container' + i)
        papaya_container.addEventListener('wheel', (event) => {
            event.preventDefault()
        })
    }

    let side_by_side_button = document.getElementById('side-by-side')
    side_by_side_button.addEventListener('click', () => {
        let papaya_container0 = document.getElementById('papaya-container0')
        if(papaya_container0.classList.contains('hide')) {
            papaya_container0.classList.remove('hide')
        } else {
            papaya_container0.classList.add('hide')
        }
        resize_viewer()
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
        file_reader.onload = (event) => load_task(event.target.result)
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

    let save = document.getElementById('save');
    save.addEventListener('click', () => {
        task.lesion = lesions
        let lesions_string = JSON.stringify(task)

        var data_string = "data:text/json;charset=utf-8," + encodeURIComponent(lesions_string);
        var download_node = document.createElement('a');
        download_node.setAttribute("href", data_string);
        download_node.setAttribute("download", "lesions.json");
        document.body.appendChild(download_node); // required for firefox
        download_node.click();
        download_node.remove();
    })

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
    toggle_crosshairs_button.addEventListener('click', () => {
        for(let i=0 ; i<2 ; i++) {
            papayaContainers[i].preferences.showCrosshairs = papayaContainers[i].preferences.showCrosshairs == 'Yes' ? 'No' : 'Yes'
            papayaContainers[i].viewer.drawViewer()
        }
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
