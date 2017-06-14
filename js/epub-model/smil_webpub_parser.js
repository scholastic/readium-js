//  Copyright (c) 2014 Readium Foundation and/or its licensees. All rights reserved.
//
//  Redistribution and use in source and binary forms, with or without modification,
//  are permitted provided that the following conditions are met:
//  1. Redistributions of source code must retain the above copyright notice, this
//  list of conditions and the following disclaimer.
//  2. Redistributions in binary form must reproduce the above copyright notice,
//  this list of conditions and the following disclaimer in the documentation and/or
//  other materials provided with the distribution.
//  3. Neither the name of the organization nor the names of its contributors may be
//  used to endorse or promote products derived from this software without specific
//  prior written permission.

define(['jquery', 'underscore'], function ($, _) {
    // `SmilWebpubParser` is used to parse R2 MO data into R1 compatible smil models
    var SmilWebpubParser = function (webpubDocument, packageFetcher) {

        // fill out all the necessary data in webpubDocument.metadata.media_overlay.smil_models
        this.fillSmilData = function (callback) {

            // flag indicating that MO processing failed
            var processingFailed = false;

            //
            // internal helper functions
            //

            // parse R2 Spine Item MO
            // this is MO Json that we are parsing
            // {
            //     "media-overlay": [
            //     {
            //         "children": [
            //             {
            //                 "children": [
            //                     {
            //                         "audio": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Audio/01_cover.mp3#t=0,1.8",
            //                         "text": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Text/p001.xhtml#f000001"
            //                     },
            //                     {
            //                         "audio": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Audio/01_cover.mp3#t=1.8,4.3",
            //                         "text": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Text/p001.xhtml#f000002"
            //                     }
            //                 ],
            //                 "role": [
            //                     "section"
            //                 ],
            //                 "text": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Text/p001.xhtml"
            //             }
            //         ],
            //         "role": [
            //             "section"
            //         ]
            //     }
            // ]
            // }
            // spineItem - Spine Item object, as filled based on R2 Web Pub
            // source - JSON representation of R2 MO data for Spine Item
            function parseSpineItemMo(spineItem, source) {

                // Spine Item smil model required by R1 MO
                var smilModel = {};

                // add to smil model
                smilModel.smilVersion = '3.0';
                smilModel.id = '';
                smilModel.href = '';
                smilModel.spineItemId = spineItem.idref;

                // first level children to smil model
                // Object {nodeType: "seq", children: Array(1)}
                smilModel.children = [];
                var child1 = {
                    nodeType: 'seq',
                    children: []
                };
                smilModel.children.push(child1);

                // second level children
                // Object {nodeType: "seq", textref: "p001.xhtml", id: "seq1", epubtype: "bodymatter chapter", children: Array(6)}
                var child2 = {
                    // todo: may have to generate different ids
                    nodeType: 'seq',
                    textref: '',
                    id: '',
                    epubtype: '',
                    children: []
                };
                smilModel.children[0].children.push(child2);

                // in source, advance to the inner array of 'par' nodes
                //     "media-overlay": [
                //     {
                //         "children": [
                //             {
                //                 "children": [
                source = source['media-overlay'][0]['children'][0]['children'];

                // third level children are 'par' smil nodes
                var destination =  smilModel.children[0].children[0].children;

                // for every child, add 'par' node to the destination
                // Object {nodeType: "par", id: "p000001", children: Array(2)}
                source.forEach(function (child) {
                    var parNode = {
                        nodeType: "par",
                        id: "", // todo: may have to generate id for the 'par' node
                        children: []
                    };

                    // handle audio part and create 'audio' child
                    // "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Audio/01_cover.mp3#t=0,1.8"
                    var fragmentParts = child.audio.split('#');
                    var timingParts = fragmentParts[1].split('=');
                    var clipParts = timingParts[1].split(',');
                    var audioChild = {
                        nodeType: "audio",
                        clipBegin: parseFloat(clipParts[0]),
                        clipEnd: parseFloat(clipParts[1]),
                        src: fragmentParts[0], // todo: it used to be relative path "../Audio/01_cover.mp3"
                    };
                    parNode.children.push(audioChild);

                    // handle text part and create 'text' child
                    // "text": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Text/p001.xhtml#f000001"
                    fragmentParts = child.text.split('#');
                    var textChild = {
                        nodeType: "text",
                        src: fragmentParts[0], // "p001.xhtml#f000001"
                        srcFile: fragmentParts[0], // "p001.xhtml"
                        srcFragmentId: fragmentParts[1] // "f000001"
                    };
                    parNode.children.push(textChild);

                    // add 'par' node to the array
                    destination.push(parNode);
                });

                return smilModel;
           }

            // process R2 Media Overlay data associateid with Spine Item
            // if there is associated MO:
            // - fetch Spine Item MO document
            // - convert it to compatible with R1 smil model data
            // * spineItem - Spine Item as formed based on R2 Web Pub
            // * return - R1 compatible smil model for the SI
            function processSpineItemMo(spineItem) {

                // if there is associated MO
                if (spineItem.properties && spineItem.properties['media-overlay']) {

                    return new Promise(function(resolve, reject) {

                        // fetch MO Spine Item data
                        var href = spineItem.properties['media-overlay'];

                        var url = packageFetcher.getEbookURL() + "/../" + href;
                        packageFetcher.getFileContentsFromPackage(url, function (txt) {
                            
                                // convert response to json object
                                // var spineItemMoJson = response.json();
                                var spineItemMoJson = JSON.parse(txt);
                                console.log("Spine Item MO data fetched: ", spineItemMoJson);

                                // convert R2 MO Spine Item into smil model expected by R1
                                var smilModel = parseSpineItemMo(spineItem, spineItemMoJson);
                                // return smilModel;
                                resolve(smilModel);
                                // callback();
                        }, function (error) {
                                console.log(error);

                                // if we fail to fetch any of the SI MO, we fail the whole thing
                                processingFailed = true;
                                reject(error);
                        });
                    });

                    // return fetch(href, {mode: 'cors'}).then(function (response) {
                    // }).catch(function (error) {
                    // });
                } else {
                    // fill in a dummy smil model
                    return Promise.resolve(makeFakeSmilJson(spineItem));
                }
            }

            // process R2 Media Overlay data associateid with Spine Item
            // if there is associated MO:
            // - fetch Spine Item MO document
            // - convert it to compatible with R1 smil model data
            function processSpineItemMoTestVersion(spineItem) {
            
                // parse test string
                var spineItemMoJson = JSON.parse(testSpineItemMoString);

                // convert R2 MO Spine Item into smil model expected by R1
                var smilModel = parseSpineItemMo(spineItem, spineItemMoJson);
                return Promise.resolve(smilModel);
            }

            var testSpineItemMoString = `{
                "media-overlay": [
                {
                    "children": [
                        {
                            "children": [
                                {
                                    "audio": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Audio/01_cover.mp3#t=0,1.8",
                                    "text": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Text/p001.xhtml#f000001"
                                },
                                {
                                    "audio": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Audio/01_cover.mp3#t=1.8,4.3",
                                    "text": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Text/p001.xhtml#f000002"
                                }
                            ],
                            "role": [
                                "section"
                            ],
                            "text": "http://localhost:3000/pub/L1VzZXJzL21pY2hhZWxzL3IyLXN0cmVhbWVyLWpzL1RhbGVzRnJwbVNoZWtzcGlyZS5lcHVi/OEBPS/Text/p001.xhtml"
                        }
                    ],
                    "role": [
                        "section"
                    ]
                }
            ]
            }`;

            function makeFakeSmilJson(spineItem) {
                return {
                    id: "",
                    href: "",
                    spineItemId: spineItem.idref,
                    children: [{
                        nodeType: 'seq',
                        textref: spineItem.href,
                        children: [{
                            nodeType: 'par',
                            children: [{
                                nodeType: 'text',
                                src: spineItem.href,
                                srcFile: spineItem.href,
                                srcFragmentId: ""
                            }]
                        }]
                    }]
                };
            }

            //
            // body starts here
            //
            // if there is nothing in spine
            if (webpubDocument.spine.length == 0) {
                return Promise.resolve();
            }

            // see if MO is part of the publication
            var mo = webpubDocument.webpubJson.links.filter(function (link) {
                if (link.rel.includes("media-overlay"))
                    return true;
            });

            // if MO is defined for this book
            if (mo.length > 0) {
                // map spine items into array of promises fulfilled after all the MO documents
                // for individual SIs are fetched and parsed
                // var promises = webpubDocument.spine.map(processSpineItemMoTestVersion);
                var promises = webpubDocument.spine.map(processSpineItemMo);

                return Promise.all(promises).then(function (smilModels) {
                    if (processingFailed) {
                        webpubDocument.metadata.media_overlay.smil_models = [];
                    } else {
                        webpubDocument.metadata.media_overlay.smil_models = smilModels;
                    }
                    return Promise.resolve();
                }).catch(function(error) {
                    console.log(error);
                    webpubDocument.metadata.media_overlay.smil_models = [];
                    return Promise.resolve();
                });
            }

            // no MO is defined
            webpubDocument.metadata.media_overlay.smil_models = [];
            return Promise.resolve();
        }
    };

    return SmilWebpubParser;
});
