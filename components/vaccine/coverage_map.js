import React from 'react'
import mapboxgl from 'mapbox-gl'
import Head from 'next/head'

import provincesData from '../gis/data/provincial-vaccination-data.json'
import _ from 'lodash'
import moment from 'moment'

const InfoBox = (props) => (
    <div className='infoBox rounded shadow-sm' style={{ width: 300 }}>
        {
            props.hoveredData &&
            <div>
                <div>
                    <span><b>จังหวัด{props.hoveredData['name']}</b></span><br />
                    <div className='row' style={{ fontSize: '90%' }}>
                        <div className='col-7 pr-0'>
                            <div>ได้รับวัคซีนครบแล้ว</div>
                        </div>
                        <div className='col-5 d-flex justify-content-center align-items-center'>
                            <div>
                                <b>{(props.hoveredData['total-2nd-dose'] * 100 / props.hoveredData['population']).toFixed(1)}%</b>
                            </div>
                            <div className='ml-2 doses-progress-map'>
                                <div className='doses-bar' style={{ width: `${(props.hoveredData['total-2nd-dose'] * 100 / props.hoveredData['population'])}%` }}></div>
                            </div>
                        </div>
                        <div className='col-7 pr-0'>
                            <div>ได้รับวัคซีนอย่างน้อย 1 โดส</div>
                        </div>
                        <div className='col-5 d-flex justify-content-center align-items-center'>
                            <div>
                                <b>{(props.hoveredData['total-1st-dose'] * 100 / props.hoveredData['population']).toFixed(1)}%</b>
                            </div>
                            <div className='ml-2 doses-progress-map'>
                                <div className='doses-bar' style={{ width: `${(props.hoveredData['total-1st-dose'] * 100 / props.hoveredData['population'])}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        }
    </div>
)

class Map extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            lng: 101.10,
            lat: 13.12,
            zoom: 4.5,
            hoveredData: null
        };
        this.map
    }
    resetMap() {
        this.map.flyTo({ center: [101.10, 13.12], zoom: 4.5 })
    }
    componentDidMount() {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_mapboxKey
        this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: 'mapbox://styles/townhall-th/ckjp7wsca4inq19pbfpm6leov',
            center: [this.state.lng, this.state.lat],
            zoom: this.state.zoom,
            maxBounds: [[83.271483, 4], [117, 22]],
            minZoom: 3,
        });
        this.map.scrollZoom.disable()
        this.map.dragRotate.disable()
        this.map.touchZoomRotate.disableRotation()
        this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }))
        this.map.on('move', () => {
            this.setState({
                lng: this.map.getCenter().lng.toFixed(4),
                lat: this.map.getCenter().lat.toFixed(4),
                zoom: this.map.getZoom().toFixed(2)
            });
        });
        this.map.on('load', () => {
            console.log('Map Loaded')
            // Add a geojson point source.
            // Heatmap layers also work with a vector tile source.
            this.map.addSource('provinces', {
                type: 'vector',
                url: 'mapbox://townhall-th.c5vzwe91'
            })
            this.map.addSource('provinces-label', {
                type: 'vector',
                url: 'mapbox://townhall-th.72khtg8y'
            })
            var coverages = []
            var provinceMatch = ['match', ['get', 'PROV_CODE']]
            provincesData['data'].forEach((row) => {
                provinceMatch.push(String(row['id']), row['coverage'])
                coverages.push(row['coverage'])
            })
            const maxCoverage = Math.max(...coverages)
            this.props.setMaxCoverage(maxCoverage)
            provinceMatch.push(0)

            this.map.addLayer({
                'id': 'province-fills',
                'type': 'fill',
                'source': 'provinces',
                'source-layer': 'thmapprovinceswithcentroidsid',
                'layout': {},
                'paint': {
                    'fill-opacity': 0.6,
                    'fill-color': [
                        'interpolate',
                        ['linear'],
                        provinceMatch,
                        0,
                        '#bdd5cd',
                        maxCoverage * 0.3,
                        '#9dbbb2',
                        maxCoverage * 0.5,
                        '#7ea297',
                        maxCoverage * 0.7,
                        '#60897e',
                        maxCoverage,
                        '#427165',
                    ],
                }
            })
            this.map.addLayer({
                'id': 'provinces-outline',
                'type': 'line',
                'source': 'provinces',
                'source-layer': 'thmapprovinceswithcentroidsid',
                'paint': {

                    'line-color': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        '#212121',
                        'rgba(255,255,255,0.2)'
                    ],
                    'line-width': 1
                }
            });
            this.map.addLayer({
                'id': 'province-label',
                'type': 'symbol',
                'source': 'provinces-label',
                'source-layer': 'provinces_centroids-ac2kba',
                'minzoom': 5,
                'layout': {
                    'text-field': ['get', 'PROV_NAMT'],
                    'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
                    'text-justify': 'center',
                    'text-size': 12
                },
                'paint': {
                    "text-color": "#ffffff",
                    "text-halo-width": 0.8,
                    'text-halo-blur': 1,
                    'text-halo-color': '#424242',
                    'text-opacity': ['interpolate', ['linear'], ['zoom'], 7.8, 1],
                }
            })

            var hoveredStateId = null
            this.map.on('click', 'province-fills', (e) => {
                const centroid = JSON.parse(e.features[0].properties['centroid'])
                this.map.flyTo({ center: centroid, zoom: 7 })
            })
            this.map.on('mousemove', 'province-fills', (e) => {
                this.setState({ infoBoxPosition: e.point })
                if (e.features.length > 0) {
                    if (hoveredStateId) {
                        this.map.setFeatureState(
                            { source: 'provinces', sourceLayer: 'thmapprovinceswithcentroidsid', id: hoveredStateId },
                            { hover: false }
                        );
                    }
                    hoveredStateId = e.features[0].id;
                    this.map.setFeatureState(
                        { source: 'provinces', sourceLayer: 'thmapprovinceswithcentroidsid', id: hoveredStateId },
                        { hover: true }
                    )
                    if (!this.state.hoveredData) {
                        const data = _.find(provincesData['data'], { id: e.features[0].properties['PROV_CODE'] })
                        this.setState({ hoveredData: data })

                    }
                    else if (this.state.hoveredData['id'] !== (e.features[0].properties['PROV_CODE'])) {
                        const data = _.find(provincesData['data'], { id: (e.features[0].properties['PROV_CODE']) })
                        this.setState({ hoveredData: data })

                    }

                }
            });
            this.map.on('mouseleave', 'province-fills', (e) => {
                if (hoveredStateId) {
                    this.map.setFeatureState(
                        { source: 'provinces', sourceLayer: 'thmapprovinceswithcentroidsid', id: hoveredStateId },
                        { hover: false }
                    )
                }
                if (this.state.hoveredData) {
                    this.setState({ hoveredData: null })
                }
                hoveredStateId = null;
            })
        });
    }
    skipMap() {
        scroller.scrollTo('skipMap', {
            smooth: true,
            duration: 400,
            offset: -100
        })
    }
    render() {
        return (
            <div>
                <Head>
                    <link href='https://api.mapbox.com/mapbox-gl-js/v2.0.1/mapbox-gl.css' rel='stylesheet' />
                </Head>
                <div className='mapContainer'>
                    <div ref={el => this.mapContainer = el} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}></div>
                    <div onClick={() => this.resetMap()} className='reset-button'>
                        <button className='btn-icon'><img src='/fullscreen_exit-black.svg' alt='reset zoom' /></button>
                    </div>
                    {this.state.hoveredData &&
                        <div className='infoBox-container d-md-block d-none' style={{ top: this.state.infoBoxPosition.y + 20, left: this.state.infoBoxPosition.x }}>
                            <InfoBox hoveredData={this.state.hoveredData} />
                        </div>
                    }
                    {this.state.hoveredData &&
                        <div className='infoBox-container d-md-none d-block' >
                            <InfoBox hoveredData={this.state.hoveredData} />
                        </div>
                    }

                </div>
                <div className='container text-sec mt-3 credit' style={{ maxWidth: 810 }}>
                    ที่มาข้อมูล: ระบบติดตามการขนส่งวัคซีน กระทรวงสาธารณสุข (อัพเดทล่าสุดเมื่อ {moment(provincesData['update_at']).format('LL')}), สถิติประชากรศาสตร์ สำนักงานสถิติแห่งชาติ
                </div>
            </div>
        )
    }
}

export default Map