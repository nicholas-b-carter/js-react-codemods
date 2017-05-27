import {
    Button,
    Flex,
    FlexBox,
    FlexItem,
    Icon,
    Popover,
    ScrollView,
    Text
} from '@madmobilenpm/mmui';
import { FormattedMessage, injectIntl } from 'react-intl';
import React, { Component } from 'react';
import {
    compose,
    connect,
    withModuleFeatures,
    withStyles,
    withToast,
    withToggleState
} from '_util/HOCs';
import { getCheckedInCustomerCount, getCheckedInCustomersSelector } from '_redux/selectors';
import { saveProductForCheckin, toggleCustomerSelectionModal } from 'actions/personal-shopper';
import { withHandlers, withProps, withState } from 'recompose';

import AddToLookContainer from 'components/look-builder/AddToLookContainer';
import AtcDataModal from './AtcDataModal';
import CustomerCard from 'components/blackbook/CustomerCard';
import FindIt from '../FindIt';
import Modal from '_shared/Modal';
import NoCustomersModal from 'components/personal-shopper/NoCustomersModal';
import PriceRow from './PriceRow';
import ProductCard from 'components/catalog/products/ProductCard';
import ProductDetailReviews from 'components/catalog/products/ProductDetailReviews';
import PropTypes from 'prop-types';
import QuantitySelector from '../QuantitySelector';
import RatingStars from '_shared/RatingStars';
import Spinner from '_shared/Spinner';
import VariantWidget from '_shared/pdp-widgets/VariantWidget';
import { destroyAtcResults } from 'actions/cart';
import getCurrencyFormat from '_util/currencyFormats';
import messages from './messages';

const resultCardStyles = {
    customerCard: {
        width: '280px',
        marginBottom: '10px'
    }
};

const CustomerResultCard = withStyles(
    ({ theme: { colors: { secondary } }, isSelected }) =>
        isSelected
            ? Object.assign(resultCardStyles, {
                  border: `1px solid ${secondary}`,
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)'
              })
            : resultCardStyles
)(({ styles: { customerCard }, customer, onClick }) => (
    <div style={customerCard}>
        <CustomerCard onClick={onClick} checkedIn customer={customer} />
    </div>
));

const PopoverMenu = ({ formatMessage, onClick, checkInCustomer, checkedInCustomers }) => (
    <div>
        <FlexBox column flex="0 0 auto">
            <FlexBox
                style={{
                    margin: '15px 0px 10px 30px',
                    width: '100%',
                    justifyContent: 'space-between'
                }}
            >
                <div style={{ textAlign: 'center', color: '#888899', display: 'inline-flex' }}>
                    {formatMessage(messages.popoverAddToBag)}
                </div>
                <div style={{ position: 'absolute', right: 20, top: 10 }}>
                    <Button onClick={checkInCustomer} width={40} style={{ display: 'inline-flex' }}>
                        <Icon name="create-fill" color="#4f89f3" size={30} />
                    </Button>
                </div>
            </FlexBox>
            <ScrollView
                style={{ maxHeight: '280px', minHeight: '130px' }}
                scrollStyle={{ padding: '0 0 0 15px' }}
            >
                {checkedInCustomers.length
                    ? checkedInCustomers.map((customer, key) => (
                          <CustomerResultCard
                              customer={customer}
                              onClick={onClick}
                              isSelected={false}
                              key={key.toString()}
                          />
                      ))
                    : <div>{formatMessage(messages.popoverNoCustomers)}</div>}
            </ScrollView>
        </FlexBox>
    </div>
);

class ProductDetail extends Component {
    static contextTypes = {
        router: PropTypes.object.isRequired,
        theme: PropTypes.object,
        viewportSize: PropTypes.string
    };

    static propTypes = {
        product: PropTypes.object.isRequired,
        updateVariants: PropTypes.func.isRequired,
        getProductSku: PropTypes.func.isRequired,
        addProductToCart: PropTypes.func.isRequired,
        isLoadingVariants: PropTypes.bool.isRequired
    };

    constructor(props, context) {
        super(props, context);

        this.currencyFormat = getCurrencyFormat(props.locale);

        this.state = {
            variantsLoadedLag: true,
            selectedVariants: this.getSelectedVariants(props.product.toJS().variants),
            findItModalOpen: false,
            addToLookModalOpen: false,
            expanded: {
                description: [false],
                isFlipped: [false],
                title: [false],
                price: [false],
                inventory: [false]
            }
        };
    }

    componentDidMount() {
        const product = this.props.product.toJS();
        if (product.variantSkuId) {
            this.props.getProductSku(product);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.product.get('variants') !== this.props.product.get('variants')) {
            const nextProduct = nextProps.product.toJS();
            const selectedVariants = this.getSelectedVariants(nextProduct.variants);
            this.setState(Object.assign({}, this.state, { selectedVariants }));

            if (nextProduct.variantSkuId) {
                this.props.getProductSku(nextProduct);
            }
        }

        if (nextProps.locale !== this.props.locale) {
            this.currencyFormat = getCurrencyFormat(nextProps.locale);
        }

        if (!this.props.isLoadingVariants && nextProps.isLoadingVariants) {
            this.setState(
                Object.assign({}, this.state, {
                    variantsLoadedLag: false
                })
            );
        }
    }

    componentWillUnmount() {
        this.props.resetVariants(this.props.product.get('id'));
    }

    getSelectedVariants(variants) {
        return variants.reduce((acc, variant) => {
            if (variant.selected !== undefined && variant.selected !== null) {
                return {
                    ...acc,
                    [variant.id]: variant.selected
                };
            }
            return acc;
        }, {});
    }

    closeFindItModal = () => {
        this.setState({ findItModalOpen: false });
    };

    handleProductAddedToLook = () => {
        const { formatMessage } = this.props;
        this.context.toast.addNotification({
            title: formatMessage(messages.productAdded),
            message: formatMessage(messages.addedToLook),
            level: 'info',
            autoDismiss: 3,
            style: false,
            position: 'tr'
        });
    };

    handleVariantSelection = selection => {
        const selectedVariants = { ...this.state.selectedVariants, ...selection };
        this.props.updateVariants(
            this.state.selectedVariants,
            selectedVariants,
            this.props.product.toJS()
        );
    };

    hideAddToLookModal = () => {
        this.setState({ addToLookModalOpen: false });
    };

    openFindItModal = () => {
        this.props
            .loadLocationData(this.props.product.get('id'))
            .then(() => this.setState({ findItModalOpen: true }));
    };

    showAddToLookModal = () => {
        this.setState({ addToLookModalOpen: true });
    };

    toggleField = (field, child = 0) => {
        const tempState = { ...this.state };
        if (!this.state.expanded[field].length > child && !this.state.expanded[field][child]) {
            tempState.expanded[field][child] = false;
        } else {
            tempState.expanded[field][child] = !tempState.expanded[field][child];
        }

        this.setState(tempState);
    };

    viewRecommendedProduct = product => {
        this.context.router.push(`/catalog/products/${product.id}`);
    };

    renderATC() {
        return (
            <FlexBox flex="1 1 auto" style={{ margin: '30px' }}>
                <Button
                    type="primary"
                    disabled={!this.props.product.toJS().finalSku}
                    onClick={this.props.atcDataModalOn}
                    data-id="AtcTrigger"
                    width="100%"
                >
                    <FormattedMessage {...messages.checkDeliveryDates} />
                </Button>
            </FlexBox>
        );
    }

    renderBuyActions(product) {
        const { colors } = this.context.theme;
        const { formatMessage } = this.props.intl;
        const { catalogFeatures } = this.props;
        const styles = {
            container: {
                margin: '0 30px 20px 30px',
                flexWrap: 'wrap',
                flexDirection: 'row',
                alignItems: 'stretch',
                justifyContent: 'space-around'
            }
        };

        const sku = Boolean(product.finalSku) && product.finalSku;
        const storeDisabled = !sku || sku.storeQty < 1;
        const webDisabled = !sku || sku.webQty < 1;

        return (
            <FlexBox style={styles.container}>
                {catalogFeatures.displayBuyInStore &&
                    this.renderCta(
                        this.props.buyInStore,
                        true,
                        formatMessage(messages.buyInStore),
                        storeDisabled,
                        colors,
                        styles,
                        formatMessage,
                        this.props.checkedInCustomers
                    )}
                {catalogFeatures.displayBuyOnline &&
                    this.renderCta(
                        this.props.buyOnline,
                        false,
                        formatMessage(messages.buyOnline),
                        webDisabled,
                        colors,
                        styles,
                        formatMessage,
                        this.props.checkedInCustomers
                    )}
                {this.props.catalogFeatures.findIt &&
                    <Flex style={{ margin: '5px' }}>
                        <Button
                            disabled={!sku}
                            flex="3"
                            outline
                            data-id="findItButton"
                            onClick={this.openFindItModal}
                        >
                            {formatMessage(messages.findIt)}
                        </Button>
                    </Flex>}
            </FlexBox>
        );
    }

    renderCta(
        onClick,
        inStore,
        label,
        disabled,
        colors,
        styles,
        formatMessage,
        checkedInCustomers
    ) {
        return (
            <Flex flex="1 1 auto" style={{ margin: '5px' }}>
                <Popover
                    position="left"
                    width="310px"
                    autoClose
                    activeTriggerProps={{ style: { opacity: 0.5 } }}
                    content={PopoverMenu({
                        styles,
                        colors,
                        formatMessage,
                        checkedInCustomers,
                        onClick,
                        checkInCustomer: inStore
                            ? this.props.checkInNewCustomerInStore
                            : this.props.checkInNewCustomerOnline
                    })}
                >
                    <Button
                        disabled={disabled}
                        type="primary"
                        data-id="buyInStoreButton"
                        width="100%"
                    >
                        {label}
                    </Button>
                </Popover>
            </Flex>
        );
    }

    renderImageVariant(variant, index, isSelected) {
        const { colors } = this.context.theme;
        const option = variant.options[index];
        const optionValue = option.value || option;
        const variantData = this.props.product.toJS().variantData[variant.id][optionValue];
        const styles = {
            container: {
                width: 28,
                height: 28,
                borderRadius: 14,
                border: `2px solid ${isSelected ? colors.red : 'transparent'}`
            },
            variantOption: {
                width: 24,
                height: 24,
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid white',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
                backgroundImage: `url(${variantData.image})`
            }
        };

        return (
            <div style={styles.container}>
                <div style={styles.variantOption} />
            </div>
        );
    }

    renderInventory(product) {
        const { colors } = this.context.theme;
        const { formatMessage } = this.props.intl;
        const expanded = this.state.expanded.inventory[0];
        const height = expanded ? null : '60px';
        const sku = product.finalSku;
        const styles = {
            container: {
                margin: '0 30px 30px',
                border: `1px solid ${colors.grey}`,
                borderRadius: 4,
                padding: sku ? '5px 0 5px 30px' : '5px 30px',
                height,
                overflow: 'hidden'
            },
            noInventoryContainer: {
                margin: '0 30px 30px 30px',
                border: `1px solid ${colors.grey}`,
                borderRadius: 4,
                padding: '10px 30px'
            },
            count: {
                fontSize: 12,
                fontWeight: 600,
                lineHeight: '18px',
                color: '#FFF',
                borderRadius: '.7rem',
                background: sku && sku.storeQty > 0 ? colors.secondary : colors.mid,
                padding: '0 10px'
            }
        };

        const buildInventory = ({ storeQty = 0 }, key) => (
            <FlexItem
                key={key.toString()}
                style={{ flexDirection: 'column', margin: '5px 0 10px' }}
            >
                <Text data-id="inStoreMessage">
                    {formatMessage(messages.storeInventory)}
                </Text>
                <Text data-id="inStoreAmount" style={styles.count}>{storeQty}</Text>
            </FlexItem>
        );

        const buildInventories = () =>
            sku
                ? <FlexBox style={styles.container} justify="space-between">
                      <div style={{ flex: '1 1 100%', alignSelf: 'baseline' }}>
                          {buildInventory(sku, 0)}
                      </div>
                      <div
                          style={{
                              flex: '1 1 auto',
                              margin: '0 10px',
                              alignSelf: 'baseline'
                          }}
                      />
                  </FlexBox>
                : <FlexBox style={styles.container} justify="space-between">
                      {buildInventory(sku, 0)}
                  </FlexBox>;

        return sku
            ? buildInventories()
            : <FlexBox style={styles.noInventoryContainer} justify="center">
                  <Text color={colors.mid} lineHeight="18px">
                      <FormattedMessage {...messages.inStoreInventory} />
                  </Text>
              </FlexBox>;
    }

    renderPricePoints(product) {
        const { colors } = this.context.theme;
        const { formatMessage } = this.props;
        const { accordionLimit } = product;
        const expanded = this.state.expanded.price[0];
        const pricing = product.finalSku &&
            Array.isArray(product.finalSku) &&
            product.finalSku[0].pricing
            ? product.finalSku[0].pricing
            : product.pricing;

        /*
      accordionLimit is set by the client in the portal, we want to allow the client to display
      a configurable number of prices before the user has to expand the accordion.  We also don't
      want to have them set a limit of 4 and only supply 3 items, having an accordion with nothing in it.
    */
        const height = accordionLimit <= 2 ? 52 : 120;
        const styles = {
            container: {
                height: expanded ? 'auto' : height,
                overflow: 'hidden',
                flex: '1 1 100%',
                alignSelf: 'baseline'
            },
            label: {
                marginBottom: 5
            }
        };

        if (!pricing) {
            return (
                <FlexBox style={styles.container}>
                    <Text size={14} lineHeight="24px" color={colors.mid}>
                        {formatMessage('pdp.inStorePricing')}
                    </Text>
                </FlexBox>
            );
        }

        const toggleOnClick = () => this.toggleField('price');

        const prices = Array.isArray(pricing) ? pricing : [pricing];

        const pricePairs = [];
        // Grab prices in pairs
        for (let i = 0; i < prices.length; i += 2) {
            pricePairs.push([prices[i], prices[i + 1] || '']);
        }

        return (
            !!prices.length &&
            <div style={{ marginBottom: 16, padding: '0px 30px 20px' }}>
                <FlexBox>
                    <div style={styles.container}>
                        {pricePairs.map((pricePair, index) => (
                            <PriceRow
                                pricePair={pricePair}
                                styles={{ ...styles, colors }}
                                index={index}
                                currencyFormat={this.currencyFormat}
                            />
                        ))}
                    </div>
                    {prices.length > accordionLimit &&
                        <div style={{ flex: '1 1 auto', alignSelf: 'baseline' }}>
                            <Button icon={expanded ? 'x-med' : 'plus'} onClick={toggleOnClick} />
                        </div>}
                </FlexBox>
            </div>
        );
    }

    renderProductDescription(product) {
        const DESC_LINE_HEIGHT = 23;
        const DESC_MAX_LINES = 3;
        const DESC_TITLE_HEIGHT = 34;
        const { formatMessage } = this.props.intl;
        const { colors } = this.context.theme;

        const descriptions = Array.isArray(product.longDescription)
            ? product.longDescription
            : [product.longDescription];

        return descriptions.map((desc, key) => {
            const expanded = this.state.expanded.description[key];
            const toggleDescription = () => this.toggleField('description', key);

            const styles = {
                descriptionWrapper: {
                    height: expanded
                        ? 'auto'
                        : `${DESC_LINE_HEIGHT * DESC_MAX_LINES + DESC_TITLE_HEIGHT}px`,
                    overflow: 'hidden'
                },
                wrapper: {
                    lineHeight: `${DESC_LINE_HEIGHT}px`,
                    color: colors.mid
                }
            };

            return (
                <div key={key.toString()} style={styles.descriptionWrapper}>
                    <FlexBox justify="space-between">
                        <Text data-id="productDescription" preset="heading2">
                            {desc.title ? desc.title : formatMessage(messages.description)}
                        </Text>
                        <Button
                            data-id={expanded ? 'readLessX' : 'readMorePlus'}
                            icon={expanded ? 'x-med' : 'plus'}
                            onClick={toggleDescription}
                        />
                    </FlexBox>
                    <FlexBox>
                        <div
                            style={{
                                flex: '1 1 auto',
                                alignSelf: 'baseline',
                                marginRight: '35px'
                            }}
                        >
                            <div
                                className="inherit-format"
                                style={styles.wrapper}
                                dangerouslySetInnerHTML={{ __html: desc.value }}
                            />
                            <Button
                                data-id="readMoreLink"
                                simple
                                onClick={toggleDescription}
                                style={{ padding: 0, color: colors.plannerBlue }}
                            >
                                {expanded
                                    ? formatMessage(messages.viewLess)
                                    : formatMessage(messages['taskActivity.viewMore'])}
                                ...
                            </Button>
                        </div>
                    </FlexBox>
                </div>
            );
        });
    }

    renderProductTitle(product) {
        const {
            reviews: { summary: { averageOverallRating = null } = {} } = {},
            modelNumber,
            shortDescription: name
        } = product;
        const {
            state: { expanded: { title: [expanded] } },
            props: { catalogFeatures: { productReviews } },
            context: { theme: { colors: { whiteIsh } } }
        } = this;

        const toggleReviews = () => this.toggleField('isFlipped');
        const titles = Array.isArray(name) ? name : [name];

        const buildTitleField = () => {
            const hasReviews = !!(productReviews && averageOverallRating);
            const titleEl =
                name &&
                <Text data-id="productTitle" preset="display">
                    {name}
                </Text>;
            const detailEl =
                hasReviews &&
                <Button
                    data-id="toggleDetailIcon"
                    icon="info"
                    iconSize={24}
                    onClick={toggleReviews}
                />;
            const productNumberEl = (
                <Text data-id="productNumber" preset="subtext" style={{ marginRight: 20 }}>
                    <FormattedMessage {...messages.item} /> {modelNumber}
                </Text>
            );
            const reviewsEl = (
                <RatingStars rating={averageOverallRating} backgroundFill={whiteIsh} />
            );

            return (
                <FlexItem style={{ flexDirection: 'column', margin: '5px 0' }}>
                    <FlexBox justify="space-between" align="flex-start" style={{ marginBottom: 8 }}>
                        {titleEl}
                        {detailEl}
                    </FlexBox>
                    <FlexBox>
                        {productNumberEl}
                        {reviewsEl}
                    </FlexBox>
                </FlexItem>
            );
        };

        const titlesEl = expanded ? titles.map(buildTitleField) : buildTitleField();

        const toggleTitle = () => this.toggleField('title');

        return (
            !!titlesEl &&
            <div style={{ marginBottom: 16 }}>
                <FlexBox>
                    <div style={{ flex: '1 1 100%', alignSelf: 'baseline' }}>
                        {titlesEl}
                    </div>
                    {titles.length > 1 &&
                        <div style={{ flex: '1 1 auto', alignSelf: 'baseline' }}>
                            <Button icon={expanded ? 'x-med' : 'plus'} onClick={toggleTitle} />
                        </div>}
                </FlexBox>
            </div>
        );
    }

    renderRecommendedItems(product, cardConfig) {
        const portrait = this.context.viewportSize !== 'lg';
        const { formatMessage } = this.props.intl;
        if (!product.recommended || !product.recommended.length) {
            return null;
        }
        return (
            <div>
                <Text style={{ margin: '0 30px 13px 30px' }}>
                    {formatMessage(messages.recommendedItems)}
                </Text>
                <FlexBox style={{ padding: '2px 25px 5px 25px', overflow: 'scroll' }}>
                    {product.recommended.map((rProduct, index) => (
                        <ProductCard
                            key={index.toString()}
                            config={cardConfig}
                            style={{
                                padding: '0 5px',
                                width: portrait ? '50%' : '38%',
                                height: 'auto',
                                flex: '1 0 auto'
                            }}
                            styling={{
                                detailWrapper: {
                                    padding: 10
                                },
                                productName: {
                                    fontSize: 12
                                }
                            }}
                            imageHeight={portrait ? 110 : 130}
                            detailHeight={50}
                            whRatio={1.3}
                            item={rProduct}
                            onProductSelection={this.viewRecommendedProduct}
                        />
                    ))}
                </FlexBox>
            </div>
        );
    }

    renderTextVariant(variant, index, isSelected) {
        const { colors } = this.context.theme;
        const color = isSelected ? colors.red : colors.mid;
        const styles = {
            container: {
                height: 34,
                padding: '0px 12px',
                borderRadius: 4,
                border: `1px solid ${color}`
            }
        };

        return (
            <FlexBox justify="center" style={styles.container}>
                <Text data-id={variant.options[index]} nowrap align="center" color={color}>
                    {variant.options[index]}
                </Text>
            </FlexBox>
        );
    }

    renderVariantOption = (variant, index, isSelected) => {
        if (variant.displayType === 'image') {
            return this.renderImageVariant(variant, index, isSelected);
        }
        return this.renderTextVariant(variant, index, isSelected);
    };

    renderVariantWidget = (variant, index) => {
        const isImageType = variant.displayType === 'image';
        const styles = {
            container: {
                margin: isImageType ? '0 15px 15px 15px' : '0 22px 15px 22px'
            },
            optionsWrapperStyle: {
                flexFlow: 'row wrap'
            },
            optionStyle: {
                flex: '0 0 auto',
                minWidth: isImageType ? 28 : 90,
                padding: isImageType ? '0 15px 15px 15px' : '0 8px 15px 8px'
            },
            labelWrapperStyle: {
                padding: isImageType ? '0 15px' : '0 8px'
            }
        };

        return (
            <VariantWidget
                key={index.toString()}
                style={styles.container}
                optionStyle={styles.optionStyle}
                optionsWrapperStyle={styles.optionsWrapperStyle}
                labelWrapperStyle={styles.labelWrapperStyle}
                onSelect={this.handleVariantSelection}
                variant={variant}
                renderOption={this.renderVariantOption}
            />
        );
    };

    render() {
        const product = this.props.product.toJS();
        const cardConfig = this.props.cardConfig;
        const { colors } = this.context.theme;
        const { formatMessage } = this.props.intl;
        const styles = {
            container: {
                background: colors.whiteIsh,
                position: 'relative'
            },
            perspectiveWrapper: {
                position: 'relative'
            },
            flippableView: {
                width: '100%',
                background: colors.whiteIsh
            },
            frontRightScrollView: {
                display: this.state.expanded.isFlipped[0] ? 'none' : 'block'
            },
            backRightScrollView: {
                display: !this.state.expanded.isFlipped[0] ? 'none' : 'block'
            },
            leftScrollWrapper: {
                position: 'relative',
                height: '100%',
                background: '#DDD'
            },
            frontRightScrollWrapper: {
                position: 'relative',
                padding: '28px 0'
            },
            backRightScrollWrapper: {
                padding: '28px 0'
            },
            productImageWrapper: {
                overflow: 'hidden'
            },
            productImage: {
                display: 'block',
                width: '100%'
            },
            loadingScrim: {
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                background: 'rgba(255, 255, 255, 0.7)'
            },
            loadingScrimInner: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate3d(-50%, -50%, 0)',
                transition: 'all .5s',
                width: 120,
                height: 120,
                borderRadius: 5,
                opacity: this.state.variantsLoadedLag ? 0 : 1
            },
            variantErrorBar: {
                position: 'absolute',
                bottom: 0,
                width: '100%',
                height: 34,
                background: colors.mid
            },
            addToLookButton: {
                position: 'absolute',
                top: 30,
                right: 12,
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#FFF',
                zIndex: 2
            }
        };

        const toggleReviews = () => this.toggleField('isFlipped');

        return (
            <FlexBox align="stretch" flex="1 1 100%" style={styles.container}>
                {this.props.atcToggle &&
                    <AtcDataModal
                        atcData={this.props.atcData}
                        queryATC={this.props.queryATC}
                        product={this.props.product}
                        destroyAtcResults={this.props.destroyAtcResults}
                        active={this.props.atcDataModal}
                        onClose={this.props.atcDataModalOff}
                    />}

                {/* Image scroller */}
                <FlexBox flex column stretch style={{ position: 'relative' }}>
                    {this.props.catalogFeatures.lookBuilder &&
                        <Button
                            icon="rating-fill"
                            onClick={this.showAddToLookModal}
                            style={styles.addToLookButton}
                        />}

                    <ScrollView flex="1 1 100%">
                        <div style={styles.leftScrollWrapper} data-id="PDPImages">
                            {product.images.map((img, i) => (
                                <div style={styles.productImageWrapper} key={i.toString()}>
                                    <img
                                        src={img.source}
                                        style={styles.productImage}
                                        data-id={img.source}
                                        alt=""
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollView>
                </FlexBox>

                {/* Product detail */}
                <FlexBox column stretch flex style={styles.perspectiveWrapper}>
                    {/* Front pane */}
                    <ScrollView
                        flex="1 1 100%"
                        style={{ ...styles.flippableView, ...styles.frontRightScrollView }}
                    >
                        <div style={styles.frontRightScrollWrapper}>
                            {/* Title and description */}
                            <div style={{ padding: '0px 30px 20px 30px' }}>
                                {this.renderProductTitle(product)}
                                {this.renderProductDescription(product)}
                            </div>

                            {/* Prices */}
                            {this.renderPricePoints(product)}

                            {/* Variants */}
                            {product.variants.filter(v => !v.hidden).map(this.renderVariantWidget)}

                            <div style={{ margin: '0 30px 30px 30px' }}>
                                <QuantitySelector
                                    quantity={this.props.quantity}
                                    onChange={this.props.setQuantity}
                                />
                            </div>

                            {this.renderBuyActions(product)}

                            {this.renderInventory(product)}

                            {this.props.atcToggle && this.renderATC()}

                            {this.renderRecommendedItems(product, cardConfig)}
                        </div>
                    </ScrollView>

                    {/* Rear pane */}
                    <ScrollView
                        flex="1 1 100%"
                        style={{ ...styles.flippableView, ...styles.backRightScrollView }}
                    >
                        <div style={styles.backRightScrollWrapper}>
                            {this.props.catalogFeatures.productReviews &&
                                product.reviews &&
                                product.reviews.reviews &&
                                <div style={{ padding: '0px 30px 20px 30px', marginBottom: 20 }}>
                                    <FlexBox
                                        justify="space-between"
                                        align="flex-start"
                                        style={{ marginBottom: 20 }}
                                    >
                                        <Text preset="heading" data-id="productReviewsTitle">
                                            {formatMessage(messages.productReviews)}
                                        </Text>
                                        <Button
                                            data-id="toggleDetailRearIcon"
                                            icon="info"
                                            iconSize={24}
                                            onClick={toggleReviews}
                                        />
                                    </FlexBox>
                                    <ProductDetailReviews reviews={product.reviews} />
                                </div>}
                        </div>
                    </ScrollView>

                    {this.props.isLoadingVariants &&
                        <div style={styles.loadingScrim}>
                            <FlexBox style={styles.loadingScrimInner}>
                                <Spinner
                                    style={{ position: 'static', height: 13 }}
                                    type="primary"
                                />
                            </FlexBox>
                        </div>}

                    {this.props.variantError &&
                        <FlexBox justify="center" style={styles.variantErrorBar}>
                            <Text align="center" color="white">
                                {formatMessage(messages.unableToUpdateVariants)}
                            </Text>
                        </FlexBox>}
                </FlexBox>

                {this.props.catalogFeatures.findIt &&
                    <Modal
                        open={this.state.findItModalOpen}
                        anchor="bottom"
                        onClose={this.closeFindItModal}
                    >
                        <FindIt product={this.props.product} cardConfig={this.props.cardConfig} />
                    </Modal>}

                <Modal
                    open={this.state.addToLookModalOpen}
                    height="80vh"
                    onClose={this.hideAddToLookModal}
                >
                    <AddToLookContainer
                        product={product}
                        onProductAdded={this.handleProductAddedToLook}
                    />
                </Modal>

                <Modal
                    open={this.props.noCheckedInCustsModal}
                    onClose={this.props.noCheckedInCustsModalOff}
                >
                    <NoCustomersModal />
                </Modal>
            </FlexBox>
        );
    }
}

export const enhancer = compose(
    connect(
        state => ({
            checkedInCustCount: getCheckedInCustomerCount(state),
            checkedInCustomers: getCheckedInCustomersSelector(state),
            atcData: state.cart.atcData.toJS()
        }),
        {
            toggleCustomerSelectionModal,
            saveProductForCheckin,
            destroyAtcResults
        }
    ),
    injectIntl,
    withModuleFeatures('catalog'),
    withToggleState('noCheckedInCustsModal'),
    withToggleState('atcDataModal'),
    withToast,
    withState('quantity', 'setQuantity', 1),
    withProps(
        ({
            addProductToCart,
            product,
            quantity,
            intl: { formatMessage },
            toast: { addNotification }
        }) => ({
            onBuyClick: ({ customerId, firstName, lastName }, invSource) =>
                addProductToCart(product, {
                    // as a result of CPRO-749 - PDP Config
                    quantity,
                    customerId,
                    invSource
                }).then(() =>
                    addNotification({
                        title: 'Success!',
                        message: parseInt(quantity, 10) === 1
                            ? formatMessage(messages.addedToBagSingle, {
                                  firstName,
                                  lastName
                              })
                            : formatMessage(messages.addedToBagPlural, {
                                  count: quantity,
                                  firstName,
                                  lastName
                              }),
                        level: 'info',
                        autoDismiss: 3,
                        style: false,
                        position: 'tr'
                    })
                )
        })
    ),
    withHandlers({
        // hate these dup of logic, but works for now
        buyInStore: ({ onBuyClick }) => c => onBuyClick(c, 'IN_STORE'),
        buyOnline: ({ onBuyClick }) => c => onBuyClick(c, 'ONLINE'),
        checkInNewCustomerOnline: ({ product, quantity, ...props }) => () => {
            props.toggleCustomerSelectionModal();
            // save product to auto-assign to customer after checkin
            props.saveProductForCheckin(
                product.merge({
                    cartInfo: { invSource: 'ONLINE' },
                    quantity
                })
            );
        },
        checkInNewCustomerInStore: ({ product, quantity, ...props }) => () => {
            props.toggleCustomerSelectionModal();
            props.saveProductForCheckin(
                product.merge({
                    cartInfo: { invSource: 'IN_STORE' },
                    quantity
                })
            );
        }
    })
);

export default enhancer(ProductDetail);
