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

let current_image_index = 0;

let image_archive = null;
let lesions = [];
let toggle_buttons = [];

let show_loader = ()=> {
    let loader = document.getElementById('loader')
    loader.classList.remove('hide')
}

let hide_loader = ()=> {
    let loader = document.getElementById('loader')
    loader.classList.add('hide')
}

let create_toggle_button = (button_name, image_index)=> {
    let container = document.getElementById('toggle-visibility-buttons')
    let toggle_button = document.createElement("button");
    toggle_button.innerHTML = "Hide " + button_name;
    container.appendChild(toggle_button);
    toggle_button.setAttribute('data-visible', 'true')
    toggle_button.addEventListener('click', ()=> {
        let visible = toggle_button.getAttribute('data-visible')
        if(visible == 'true') {
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

let load_image_viewer = (images, image_parameters, lesion, lesion_index)=> {
    
    for(let li of loaded_images) {
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
    for(let image_parameter of image_parameters) {

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
        loaded_images.push({name: image_name, file_name: file_name, index: image_index})
        if(parameters['max'] == 1) {
            parameters['max'] = 2
        }
        // parameters['interpolation'] = false
        params[image_name] = parameters
        // params[file_name] = image_parameters[key]
        create_toggle_button(file_name, image_index)
        
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

let go_to_lesion = (lesion)=> {
    loc = lesion['location']
    var coord = new papaya.core.Coordinate();
    papayaContainers[0].viewer.getIndexCoordinateAtWorld(-loc[0], -loc[1], loc[2], coord);
    papayaContainers[0].viewer.gotoCoordinate(coord)
}

let load_image = (i)=> {
    current_image_index = i;
    if(current_image_index < 0) {
        current_image_index = lesions.length-1;
    }
    if(current_image_index >= lesions.length) {
        current_image_index = 0;
    }

    let lesion = lesions[current_image_index]
    let info = validation[lesion['name']];
    let comment = document.getElementById('comment');
    let valid = document.getElementById('valid');
    comment.value = info ? info['comment'] : ''
    valid.checked = info ? info['valid'] : false 

    let image_descriptions = lesion['images']

    let promises = []
    let image_parameters = []
    
    let need_to_load = false

    for(let image_description of image_descriptions) {
        if(loaded_images.length == 0 || loaded_images.findIndex((i)=>i.file_name == image_description.file)<0) {
            need_to_load = true;
            break
        }
    }

    let description = document.getElementById('description')

    if(!need_to_load) {
        go_to_lesion(lesion)
        description.innerText = `${lesion['name']} - ${current_image_index + 1}/${lesions.length}`
        return
    }

    for(let image_description of image_descriptions) {
        let file_name = image_description['file']
        for(let f in image_archive.files) {
            if(f.split('/').at(-1) == file_name) {
                file_name = f
                break
            }
        }
        // let promise_index = -1
        // if(loaded_images.findIndex((i)=>i.file_name == file_name)<0) {
        //     promise_index = promises.length
        // }
        
        promises.push(image_archive.file(file_name).async("base64"))
        image_parameters.push({'file_name': file_name, 'parameters': image_description['parameters'] })
        // image_parameters.push({'file_name': file_name, 'parameters': image_description['parameters'], 'promise_index': promise_index })
    }


    description.innerText = 'loading ' + lesion['name'] + '...'

    for(let tb of toggle_buttons) {
        tb.remove();
    }

    show_loader()

    Promise.all(promises).then((images)=>load_image_viewer(images, image_parameters, lesion, current_image_index))
}

let save_validation = ()=> {
    localStorage.setItem(JSON.stringify(validation))
}

document.addEventListener("DOMContentLoaded", function(event) {
    
    let load = document.getElementById('load')
    
    load.onchange = function() {
        var zip = new JSZip();
        zip.loadAsync( this.files[0] /* = file blob */)
            .then(function(local_zip) {
                image_archive = local_zip;
                for(let file in image_archive.files) {
                    if(file.endsWith('lesions.json')) {
                        return image_archive.file(file).async('text')
                    }
                }

            }).then(function(result) {
                if(result){
                    lesions = JSON.parse(result);
                } else {
                    console.log('lesions.json not found')
                }

                let viewer_container = document.getElementById('viewer-container')
                viewer_container.classList.remove('hide')
                load.classList.add('hide')
                if(lesions.length > 0){
                    load_image(0)
                }
            })
    };

    let comment = document.getElementById('comment');
    comment.addEventListener('change', ()=> {
        let lesion_name = lesions[current_image_index]['name']
        let info = validation[lesion_name];
        if(info != null) {
            validation[lesion_name]['comment'] = comment.value
        } else {
            validation[lesion_name] = {'comment': comment.value, 'valid': null }
        }
    })

    let valid = document.getElementById('valid');
    valid.addEventListener('change', ()=> {
        let lesion_name = lesions[current_image_index]['name']
        let info = validation[lesion_name];
        if(info != null) {
            validation[lesion_name]['valid'] = valid.checked
        } else {
            validation[lesion_name] = {'valid': valid.checked, 'comment': '' }
        }
    })

    let save = document.getElementById('save');
    save.addEventListener('click', ()=> {
        validation_string = JSON.stringify(validation)

        var data_string = "data:text/json;charset=utf-8," + encodeURIComponent(validation_string);
        var download_node = document.createElement('a');
        download_node.setAttribute("href",     data_string);
        download_node.setAttribute("download", "validation.json");
        document.body.appendChild(download_node); // required for firefox
        download_node.click();
        download_node.remove();
    })
    
    let prev_button = document.getElementById('prev')
    prev_button.addEventListener('click', ()=> {
        load_image(current_image_index - 1);
    })

    let next_button = document.getElementById('next')
    next_button.addEventListener('click', ()=> {
        load_image(current_image_index + 1);
    })

    let go_to_lesion_button = document.getElementById('go-to-lesion')
    go_to_lesion_button.addEventListener('click', ()=> {
        go_to_lesion(lesions[current_image_index])
    })
});