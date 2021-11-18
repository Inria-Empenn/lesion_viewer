// Remove smooth display:
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'smoothDisplay', 'No', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);
papaya.utilities.UrlUtils.createCookie(papaya.viewer.Preferences.COOKIE_PREFIX + 'showOrientation', 'Yes', papaya.viewer.Preferences.COOKIE_EXPIRY_DAYS);

// To draw / change the data of a volume:
// papayaContainers[0].viewer.screenVolumes[3].volume.imageData.data[i] = 1

let validation = localStorage.getItem('validation');
validation = validation != null ? JSON.parse(validation) : {};
papaya.Container.atlasWorldSpace = false
var params = [];

params["images"] = [];

let current_lesion_index = 0;

let image_archive = null;
let lesions = [];
let toggle_buttons = [];
let grid = null;

let show_loader = () => {
    let loader = document.getElementById('loader')
    loader.classList.remove('hide')
}

let hide_loader = () => {
    let loader = document.getElementById('loader')
    loader.classList.add('hide')
}

let create_toggle_button = (button_name, image_index) => {
    let container = document.getElementById('toggle-visibility-buttons')
    let toggle_button = document.createElement("button");
    toggle_button.innerHTML = "Hide " + button_name;
    container.appendChild(toggle_button);
    toggle_button.setAttribute('data-visible', 'true')
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
        if (parameters['max'] == 1) {
            parameters['max'] = 2
        }
        // parameters['interpolation'] = false
        params[image_name] = parameters
        // params[file_name] = image_parameters[key]
        create_toggle_button(file_name.split('/').at(-1), image_index)

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

    // params['worldSpace'] = false
    loc = lesion['location']
    // params['coordinate'] = [loc[2], loc[1], loc[0]]
    params['coordinate'] = [-loc[0], -loc[1], loc[2]]
    params['smoothDisplay'] = false
    // params['ignoreNiftiTransforms'] = true
    // params['syncOverlaySeries'] = false

    let description = document.getElementById('description')
    description.innerText = `${lesion['name']} - ${lesion_index + 1}/${lesions.length}`

    papaya.Container.resetViewer(0, params);

    hide_loader()
}

let go_to_world_coordinates = (loc) => {
    var coord = new papaya.core.Coordinate();
    papayaContainers[0].viewer.getIndexCoordinateAtWorld(loc[0], loc[1], loc[2], coord);
    papayaContainers[0].viewer.gotoCoordinate(coord)
}

let go_to_voxel_coordinates = (loc) => {
    var coord = new papaya.core.Coordinate();
    coord.x = loc[0];
    coord.y = loc[1];
    coord.z = loc[2];
    papayaContainers[0].viewer.gotoCoordinate(coord)
}

let go_to_lesion = (lesion) => {
    loc = lesion['location']
    go_to_world_coordinates([-loc[0], -loc[1], loc[2]])
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

    if(lesions.fields != null) {
        let fields_element = document.getElementById('fields')
        while(fields_element.hasChildNodes()) {
            fields_element.firstChild.remove()
        }
        for(let field of lesions.fields) {
            let field_container = document.createElement('div')
            let fiel_label = document.createElement('label')
            fiel_label.innerText = field.name
            let field_span = document.createElement('span')
            field_span.innerText = lesion[field.name]
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

    for (let image_description of image_descriptions) {
        let file_name = image_description['file']
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
        image_parameters.push({ 'file_name': file_name, 'parameters': image_description['parameters'] })
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
        rowData.push({ name: lesion.name, description: lesion.description, n_methods_which_detected_lesion: lesion.n_methods_which_detected_lesion, comment: info ? info.comment : '', valid: info ? info.valid : '' })
        // values.push([lesion.name, lesion.description, info ? info.comment : '', info ? info.valid : ''])
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

    if(lesions.fields != null) {
        for(let field of lesions.fields) {
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

    // lookup the container we want the Grid to use
    const eGridDiv = document.querySelector('#plot_div');

    // create the grid passing in the div to use together with the columns & data we want to use
    grid = new agGrid.Grid(eGridDiv, gridOptions);
    grid.gridOptions.api.sizeColumnsToFit();

    // grid.gridOptions.api.getDisplayedRowAtIndex(1).data
    // grid.gridOptions.api.getDisplayedRowCount()
    // grid.gridOptions.api.selectIndex(2)
    // grid.gridOptions.api.getSelectedNodes()[0].rowIndex
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

document.addEventListener("DOMContentLoaded", function (event) {
    resize_viewer()

    let papaya_container = document.getElementById('papaya-container')
    papaya_container.addEventListener('wheel', (event) => {
        event.preventDefault()
    })

    let load = document.getElementById('load')

    load.onchange = function () {
        var zip = new JSZip();
        zip.loadAsync(this.files[0] /* = file blob */)
            .then(function (local_zip) {
                image_archive = local_zip;
                for (let file in image_archive.files) {
                    if (file.endsWith('lesions.json')) {
                        return image_archive.file(file).async('text')
                    }
                }

            }).then(function (result) {
                if (result) {
                    lesions = JSON.parse(result);
                } else {
                    console.log('lesions.json not found')
                }

                let viewer_container = document.getElementById('viewer-container')
                viewer_container.classList.remove('hide')
                load.classList.add('hide')
                if (lesions.length > 0) {
                    create_table()
                    resize_viewer()
                    grid.gridOptions.api.selectIndex(0)
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

let write_test_volume = (data)=> {
    for(let i=0 ; i<data.length ; i++) {
        data[i] = i%255
    }
}

// write_test_volume(data)